import type { ReactNode } from 'react';
import { BookMarked, MessageCircleQuestion } from 'lucide-react';
import { TabEmpty } from '@/components/ProfileTabs';
import { CurrentlyReadingPanel } from '@/components/CurrentlyReadingPanel';
import { ReadingChallengeWidget } from '@/components/ReadingChallengeWidget';
import { readChallenge } from '@/lib/readingChallenge';
import { ShelfTable } from '@/components/ReadingShelves';
import { isShelfQuestion, shelfKindOf, readShelf } from '@/lib/shelves';
import { isCurrentlyReadingQuestion, readCurrentlyReading } from '@/lib/currentlyReading';
import { isLegacyProfileFieldKey, type ProfileQuestion } from '@/lib/profileQuestions';
import { answerText, answerImageUrls } from '@/components/ProfileQuestionAnswer';
import { QuestionIcon } from '@/components/QuestionIcon';
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
  // The reading goal only exists once the reader has actually set one (no placeholder/default goal is ever shown).
  // The eye control in Edit Profile is its public-visibility switch: when it is off, only the owner sees the widget.
  const savedChallenge=readChallenge(rawAnswers);
  const challengeNode = savedChallenge && (isOwn || savedChallenge.show===true)
    ? <ReadingChallengeWidget key="rc" challenge={savedChallenge} read={readThisYear+savedChallenge.extra} isOwn={isOwn}/>
    : null;
  const hasReadingContent=!!currentReadingNode||!!challengeNode||shelfNodes.length>0;
  const readingPane=hasReadingContent?<div className="space-y-5">{currentReadingNode}{challengeNode}{shelfNodes.length>0&&<div className={`grid grid-cols-1 ${shelfNodes.length>1?'sm:grid-cols-2':''} gap-5 items-start`}>{shelfNodes}</div>}</div>:<TabEmpty icon={<BookMarked aria-hidden="true"/>} text="Nothing on this reader's shelf yet."/>;

  return readingPane;
}

export function buildQuestionsPane({ questions, rawAnswers, vis, cardKeys }: { questions: ProfileQuestion[]; rawAnswers: Record<string, unknown>; vis: Record<string, boolean>; cardKeys: Set<string> }): ReactNode {
    const belowQuestions=questions.filter(q=>q.active!==false&&!cardKeys.has(q.key)&&!isCurrentlyReadingQuestion(q)&&!isShelfQuestion(q)&&!isLegacyProfileFieldKey(q.key)&&(vis[`question:${q.key}`]??q.public_default)!==false).map(q=>({q,value:rawAnswers[q.key]})).filter(({q,value})=>value!==undefined&&value!==null&&(q.type==='image_upload'?answerImageUrls(value).length>0:answerText(value).trim()!==''));
    if(!belowQuestions.length) return <TabEmpty icon={<MessageCircleQuestion aria-hidden="true"/>} text="No more answers shared yet."/>;
    const grouped=[...new Set(belowQuestions.map(({q})=>q.section))].map(section=>({section,items:belowQuestions.filter(({q})=>q.section===section).sort((a,b)=>a.q.sort_order-b.q.sort_order)}));
    let n = 0;
    return <div className="nl-mq">{grouped.map(group=><section key={group.section} className="nl-mq-group"><h3 className="nl-mq-section">{({'Reading Identity':'Reading taste','Beyond Books':'Beyond books'} as Record<string,string>)[group.section]||group.section}</h3>{group.items.map(({q,value})=>{ n += 1; const question=sanitizeUserText(q.question,300); return <article key={q.id} className="nl-mq-item"><span className="nl-mq-num" aria-hidden="true">{n}</span><span className="nl-mq-ic"><QuestionIcon question={question} /></span><h4 className="nl-mq-q">{question}</h4>{q.type==='image_upload'?<div className="grid grid-cols-2 gap-2">{answerImageUrls(value).map((url,i)=>{const safe=safeExternalUrl(url);return safe?<img key={i} src={safe} alt="Reader answer" loading="lazy" className="rounded-xl w-full object-cover"/>:null;})}</div>:<p className={`nl-mq-a${answerText(value).length>160?' is-long':''}`}>{sanitizeUserText(answerText(value),1200)}</p>}</article>; })}</section>)}</div>;
}
