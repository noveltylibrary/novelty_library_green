import type { ReactNode } from 'react';
import { BookMarked, MessageCircleQuestion } from 'lucide-react';
import { TabEmpty } from '@/components/ProfileTabs';
import { CurrentlyReadingPanel } from '@/components/CurrentlyReadingPanel';
import { ReadingChallengeWidget } from '@/components/ReadingChallengeWidget';
import { DEFAULT_GOAL, readChallenge } from '@/lib/readingChallenge';
import { ShelfTable } from '@/components/ReadingShelves';
import { isShelfQuestion, shelfKindOf, readShelf } from '@/lib/shelves';
import { isCurrentlyReadingQuestion, readCurrentlyReading } from '@/lib/currentlyReading';
import { isLegacyProfileFieldKey, type ProfileQuestion } from '@/lib/profileQuestions';
import { answerText, answerImageUrls } from '@/components/ProfileQuestionAnswer';
import { sanitizeUserText, safeExternalUrl } from '@/lib/sanitize';

/** Shared by the public profile and the owner's own profile so both show the same Reading / Questions tabs. */
export function buildReadingPane({ questions, rawAnswers, vis, publishedCount, readThisYear = 0, isOwn = false }: { questions: ProfileQuestion[]; rawAnswers: Record<string, unknown>; vis: Record<string, boolean>; publishedCount: number; readThisYear?: number; isOwn?: boolean }): ReactNode {
  let currentReadingNode:ReactNode|null=null;
  const shelfNodes:ReactNode[]=[];
  {
    const crQ=questions.find(q=>q.active!==false&&isCurrentlyReadingQuestion(q));
    if(crQ&&(vis[`question:${crQ.key}`]??crQ.public_default)!==false){
      const cr=readCurrentlyReading(rawAnswers[crQ.key]);
      if(cr.title||cr.cover) currentReadingNode=<CurrentlyReadingPanel key="cr" title={sanitizeUserText(cr.title,200)} author={sanitizeUserText(cr.author,100)} cover={safeExternalUrl(cr.cover)} publishedReviewCount={publishedCount}/>;
    }
    for(const kind of ['up_next','someday'] as const){
      const sq=questions.find(q=>q.active!==false&&shelfKindOf(q.key)===kind);
      if(!sq||(vis[`question:${sq.key}`]??sq.public_default)===false) continue;
      if(!readShelf(rawAnswers[sq.key]).length) continue;
      shelfNodes.push(<ShelfTable key={kind} kind={kind} value={rawAnswers[sq.key]}/>);
    }
  }
  // Reading Challenge sits directly under Currently Reading. Visitors see it only when the reader set a goal and left it public;
  // the owner always sees it (with the default goal until they choose one).
  const savedChallenge=readChallenge(rawAnswers);
  const showChallenge=isOwn||(!!savedChallenge&&savedChallenge.show);
  const challengeNode=showChallenge?<ReadingChallengeWidget key="rc" challenge={savedChallenge??{goal:DEFAULT_GOAL,tier:'custom',show:true,extra:0}} read={readThisYear+(savedChallenge?.extra??0)} isOwn={isOwn} isDefault={!savedChallenge}/>:null;
  const hasReadingContent=!!currentReadingNode||!!challengeNode||shelfNodes.length>0;
  const readingPane=hasReadingContent?<div className="space-y-5">{currentReadingNode}{challengeNode}{shelfNodes.length>0&&<div className={`grid grid-cols-1 ${shelfNodes.length>1?'sm:grid-cols-2':''} gap-5 items-start`}>{shelfNodes}</div>}</div>:<TabEmpty icon={<BookMarked aria-hidden="true"/>} text="Nothing on this reader's shelf yet."/>;

  return readingPane;
}

export function buildQuestionsPane({ questions, rawAnswers, vis, cardKeys }: { questions: ProfileQuestion[]; rawAnswers: Record<string, unknown>; vis: Record<string, boolean>; cardKeys: Set<string> }): ReactNode {
    const belowQuestions=questions.filter(q=>q.active!==false&&!cardKeys.has(q.key)&&!isCurrentlyReadingQuestion(q)&&!isShelfQuestion(q)&&!isLegacyProfileFieldKey(q.key)&&(vis[`question:${q.key}`]??q.public_default)!==false).map(q=>({q,value:rawAnswers[q.key]})).filter(({q,value})=>value!==undefined&&value!==null&&(q.type==='image_upload'?answerImageUrls(value).length>0:answerText(value).trim()!==''));
    if(!belowQuestions.length) return <TabEmpty icon={<MessageCircleQuestion aria-hidden="true"/>} text="No more answers shared yet."/>;
    const grouped=[...new Set(belowQuestions.map(({q})=>q.section))].map(section=>({section,items:belowQuestions.filter(({q})=>q.section===section).sort((a,b)=>a.q.sort_order-b.q.sort_order)}));
    return <div className="space-y-5">{grouped.map(group=><div key={group.section} className="space-y-3"><h3 className="text-sm font-bold uppercase tracking-wider" style={{color:'var(--color-cyan-dark)'}}>{({'Reading Identity':'Reading taste','Beyond Books':'Beyond books'} as Record<string,string>)[group.section]||group.section}</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{group.items.map(({q,value})=><article key={q.id} className="rounded-2xl p-4 min-w-0" style={{background:'var(--color-paper)',border:'1px solid var(--color-border)'}}><h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{color:'var(--color-teal-dark)'}}>{sanitizeUserText(q.question,300)}</h4>{q.type==='image_upload'?<div className="grid grid-cols-2 gap-2">{answerImageUrls(value).map((url,i)=>{const safe=safeExternalUrl(url);return safe?<img key={i} src={safe} alt="Reader answer" loading="lazy" className="rounded-xl w-full object-cover"/>:null;})}</div>:<p className="text-sm leading-6 whitespace-pre-wrap break-words">{sanitizeUserText(answerText(value),1200)}</p>}</article>)}</div></div>)}</div>;
}
