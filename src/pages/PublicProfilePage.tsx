import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, BookOpen, CheckCircle, User, X, Flag, AlertTriangle, BookMarked, MessageCircleQuestion, Share2, Check, UserPlus, UserCheck, Star } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchPublicProfile, fetchPublicPublishedReviews, type AcceptedReviewCard, type PublicProfileData } from '@/lib/reviews';
import { fetchFollowStats, followUsername, unfollowUsername, fetchFollowPrivacy, type FollowStats, type FollowPrivacy } from '@/lib/social';
import { FollowStatsBar, ConnectionsModal, type ConnKind } from '@/components/ConnectionsBar';
import { ProfileHighlights } from '@/components/ProfileHighlights';
import { ProfileIntro } from '@/components/ProfileIntro';
import { ProfileTabs, PublishedPanel, TabEmpty } from '@/components/ProfileTabs';
import { fetchProfileQuestions, isLegacyProfileFieldKey, type LegacyProfileFieldKey, type ProfileQuestion } from '@/lib/profileQuestions';
import { ProfileCard, asFormatKey, type ProfileCardData } from '@/components/ProfileCard';
import { answerText, answerImageUrls } from '@/components/ProfileQuestionAnswer';
import { isAdvancedQuestion } from '@/lib/profileCardPicks';
import { CurrentlyReadingPanel } from '@/components/CurrentlyReadingPanel';
import { ShelfTable } from '@/components/ReadingShelves';
import { isShelfQuestion, shelfKindOf, readShelf } from '@/lib/shelves';
import { isCurrentlyReadingQuestion, readCurrentlyReading } from '@/lib/currentlyReading';
import { fetchShelfCommunityInfo, averageNlRating, type ShelfCommunityInfo } from '@/lib/profileShelf';
import { sanitizeUserText, safeExternalUrl } from '@/lib/sanitize';
import { isUserBlacklisted, reportUser, REPORT_REASONS, type ReportReason } from '@/lib/moderation';
import { useOverlayHistory } from '@/lib/overlayHistory';

interface Props { username: string; navigate: (path: string) => void; }
export function PublicProfilePage({ username, navigate }: Props) {
  const { user, profile: myProfile } = useAuth(); const [profile,setProfile]=useState<PublicProfileData|null>(null); const [published,setPublished]=useState<AcceptedReviewCard[]>([]); const [questions,setQuestions]=useState<ProfileQuestion[]>([]); const [follow,setFollow]=useState<FollowStats>({followers:0,following:0,is_following:false}); const [privacy,setPrivacy]=useState<FollowPrivacy>({hide_followers:false,hide_following:false}); const [connKind,setConnKind]=useState<ConnKind|null>(null); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let alive=true; setLoading(true);
    // allSettled: a failing optional piece (follow stats, privacy, questions) must never hide the profile or its published reviews.
    Promise.allSettled([fetchPublicProfile(username),fetchPublicPublishedReviews(username),fetchProfileQuestions(true),fetchFollowStats(username),fetchFollowPrivacy(username)]).then(([p,pub,q,stats,priv])=>{
      if(!alive) return;
      setProfile(p.status==='fulfilled'?p.value:null);
      setPublished(pub.status==='fulfilled'?pub.value:[]);
      setQuestions(q.status==='fulfilled'?q.value:[]);
      if(stats.status==='fulfilled') setFollow(stats.value);
      if(priv.status==='fulfilled') setPrivacy(priv.value);
    }).finally(()=>{ if(alive) setLoading(false); });
    return ()=>{ alive=false; };
  },[username]);
  const [shelfInfo,setShelfInfo]=useState<Record<string,ShelfCommunityInfo>>({});
  useEffect(()=>{ let alive=true; if(!published.length){ setShelfInfo({}); return; } void fetchShelfCommunityInfo(published.map(r=>({reviewNo:r.review_no,title:r.book_title,author:r.author}))).then(m=>{ if(alive) setShelfInfo(m); }); return ()=>{alive=false;}; },[published]);
  const isOwn=!!user&&user.id===profile?.id;
  const [reportOpen,setReportOpen]=useState(false); const [reportReason,setReportReason]=useState<ReportReason>(REPORT_REASONS[0]); const [reportDetails,setReportDetails]=useState(''); const [reportBusy,setReportBusy]=useState(false); const [reportMessage,setReportMessage]=useState<string|null>(null); const [blacklisted,setBlacklisted]=useState(false);
  useOverlayHistory(reportOpen,()=>{ if(!reportBusy) setReportOpen(false); });
  useEffect(()=>{ if(profile?.novelty_username) void isUserBlacklisted(profile.novelty_username).then(setBlacklisted).catch(()=>undefined); },[profile?.novelty_username]);
  const cardData:ProfileCardData|undefined=useMemo(()=>{
    if(!profile)return undefined;
    const avg=published.filter(r=>Number(r.reviewers_rating)>0);
    // Honour the owner's eye toggles. Missing key => the question's public_default (legacy fields: visible).
    const vis=(profile.profile_visibility||{}) as Record<string,boolean>;
    const shown=(k:string,def=true)=>(vis[k]??def)!==false;
    const rawAnswers=(profile.profile_answers||{}) as Record<string,unknown>;
    const advancedSectionOrder = questions.find(q => q.section === 'Reading Identity')?.section_order;
    const firstTwoAdvancedKeys = new Set(questions.filter(q => q.section === 'Reading Identity').sort((a,b)=>a.sort_order-b.sort_order).slice(0,2).map(q=>q.key));
    const visibleQuestions=questions.filter(q=>q.active!==false&&!isCurrentlyReadingQuestion(q)&&!isShelfQuestion(q)&&shown(`question:${q.key}`,q.public_default!==false)&&(
      q.section === 'Reading Identity' ? firstTwoAdvancedKeys.has(q.key) : (advancedSectionOrder == null ? !isAdvancedQuestion(q) : (q.section_order ?? -1) < advancedSectionOrder)
    ));
    const answers=Object.fromEntries(visibleQuestions.map(q=>{ const raw=(profile.profile_answers||{})[q.key]; if(q.type==='image_upload') return [sanitizeUserText(q.key,120), answerImageUrls(raw).map(url=>safeExternalUrl(url)).filter((url): url is string=>!!url)]; if(q.type==='select_multiple' && Array.isArray(raw)) return [sanitizeUserText(q.key,120), raw.map(v=>sanitizeUserText(answerText(v),180)).filter(Boolean)]; return [sanitizeUserText(q.key,120),sanitizeUserText(answerText(raw),1200)]; }));
    // Converted reading fields are real questions: they show only while their question is active and on the card.
    const readingConverted=questions.some(q=>isLegacyProfileFieldKey(q.key));
    const legacyOn=(k:LegacyProfileFieldKey)=>{ if(!shown(k)) return false; if(!readingConverted) return true; const q=questions.find(x=>x.key===k); return !!q&&q.active!==false; };
    const safeQuestions=visibleQuestions.filter(q=>!isLegacyProfileFieldKey(q.key)).map(q=>({...q,key:sanitizeUserText(q.key,120),question:sanitizeUserText(q.question,300)}));
    const socialLinks=(profile.social_links||[]).map(l=>({platform:sanitizeUserText(l.platform,40).toLowerCase(),url:safeExternalUrl(l.url)||''})).filter(l=>l.url);
    return {
      name:shown('name')?sanitizeUserText(profile.name,120)||null:null,
      userSince: (()=>{const d=new Date(profile.created_at); return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined,{month:'short',year:'numeric'});})(),
      username:sanitizeUserText(profile.novelty_username,80)||null,
      followerCount:follow.followers,
      avatarUrl:shown('avatar')?safeExternalUrl(profile.avatar_url):null,
      headerImageUrl:shown('header_image')?safeExternalUrl(profile.header_image_url):null,
      superBlitzBannerUrl:shown('header_image')&&typeof (profile.profile_answers||{}).__superblitz_banner==='string'?safeExternalUrl((profile.profile_answers as Record<string,unknown>).__superblitz_banner as string):null,
      socialLinks,
      instagram:(!shown('instagram')?null:sanitizeUserText(profile.instagram_id,80)||null),
      booksThisMonth:legacyOn('books_read_this_month')?profile.books_read_this_month:null,totalBooksRead:legacyOn('total_books_read')?profile.total_books_read:null,publishedBooks:published.length,
      avgRating:avg.length?avg.reduce((s,r)=>s+Number(r.reviewers_rating),0)/avg.length:null,
      avgNlRating:averageNlRating(published.map(r=>({nl:shelfInfo[r.review_no]?.nlRating}))),
      readingSince:legacyOn('reading_since')?profile.reading_since:null,
      favoriteBook:legacyOn('favorite_book')?sanitizeUserText(profile.favorite_book,200)||null:null,
      favoriteAuthor:legacyOn('favorite_author')?sanitizeUserText(profile.favorite_author,160)||null:null,
      favoriteGenre:legacyOn('favorite_genre')?sanitizeUserText(profile.favorite_genre,120)||null:null,
      answers,questions:safeQuestions.filter(q => q.active !== false),
      publishedReviews:published.slice(0,6).map(r=>({id:r.id,reviewNo:sanitizeUserText(r.review_no,40)||null,title:sanitizeUserText(r.book_title,200)||'Untitled review',author:sanitizeUserText(r.author,160),coverUrl:safeExternalUrl(r.book_cover),posterUrl:shelfInfo[r.review_no]?.posterUrl||null,nlRating:shelfInfo[r.review_no]?.nlRating??null,rating:Number(r.reviewers_rating)||null}))
    };
  },[profile,published,questions,follow.followers,shelfInfo]);
  const doFollow=async()=>{if(!user){navigate('/auth');return;}if(busy)return;setBusy(true);try{if(follow.is_following)await unfollowUsername(username);else await followUsername(username);setFollow(await fetchFollowStats(username));}finally{setBusy(false);}};
  const [shared,setShared]=useState(false);
  const shareProfile=async()=>{
    const handle=profile?.novelty_username||username;
    const url=`${window.location.origin}/profile/@${encodeURIComponent(handle)}`;
    try{
      if(navigator.share){ await navigator.share({title:`@${handle} on Novelty Library`,text:`Check out @${handle}'s reader profile on Novelty Library`,url}); return; }
    }catch(e){ if((e as Error)?.name==='AbortError') return; }
    try{
      if(navigator.clipboard&&window.isSecureContext) await navigator.clipboard.writeText(url);
      else{ const t=document.createElement('textarea'); t.value=url; t.style.position='fixed'; t.style.opacity='0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
      setShared(true); window.setTimeout(()=>setShared(false),2200);
    }catch{ /* clipboard blocked */ }
  };
  if(loading)return <div className="pt-32 pb-20 container-prose text-center">Loading profile…</div>;
  if(!profile||!cardData)return <div className="pt-32 pb-20 container-prose text-center max-w-md mx-auto"><User className="w-12 h-12 mx-auto mb-4"/><h1 className="font-serif text-2xl font-semibold mb-2">Profile not found</h1><p className="text-sm mb-6" style={{color:'var(--color-text-muted)'}}>That Novelty Library username is not attached to a public account.</p><button onClick={()=>navigate('/reviews')} className="btn-ghost"><ArrowLeft className="w-4 h-4"/> Back to Reviews</button></div>;
  const openConn=(kind:ConnKind)=>{if(!isOwn&&(kind==='followers'?privacy.hide_followers:privacy.hide_following))return;setConnKind(kind);};
  const refreshStats=()=>{void fetchFollowStats(username).then(setFollow).catch(()=>undefined);};
  const vis=(profile.profile_visibility||{}) as Record<string,boolean>;
  const rawAnswers=(profile.profile_answers||{}) as Record<string,unknown>;
  let currentReadingNode:ReactNode|null=null;
  const shelfNodes:ReactNode[]=[];
  {
    const crQ=questions.find(q=>q.active!==false&&isCurrentlyReadingQuestion(q));
    if(crQ&&(vis[`question:${crQ.key}`]??crQ.public_default)!==false){
      const cr=readCurrentlyReading(rawAnswers[crQ.key]);
      if(cr.title||cr.cover) currentReadingNode=<CurrentlyReadingPanel key="cr" title={sanitizeUserText(cr.title,200)} author={sanitizeUserText(cr.author,100)} cover={safeExternalUrl(cr.cover)} publishedReviewCount={published.length}/>;
    }
    for(const kind of ['up_next','someday'] as const){
      const sq=questions.find(q=>q.active!==false&&shelfKindOf(q.key)===kind);
      if(!sq||(vis[`question:${sq.key}`]??sq.public_default)===false) continue;
      if(!readShelf(rawAnswers[sq.key]).length) continue;
      shelfNodes.push(<ShelfTable key={kind} kind={kind} value={rawAnswers[sq.key]}/>);
    }
  }
  const hasReadingContent=!!currentReadingNode||shelfNodes.length>0;
  const readingPane=hasReadingContent?<div className="space-y-5">{currentReadingNode}{shelfNodes.length>0&&<div className={`grid grid-cols-1 ${shelfNodes.length>1?'sm:grid-cols-2':''} gap-5 items-start`}>{shelfNodes}</div>}</div>:<TabEmpty icon={<BookMarked aria-hidden="true"/>} text="Nothing on this reader's shelf yet."/>;
  const questionsPane=(()=>{
    const cardKeys=new Set(cardData.questions.map(q=>q.key));
    const belowQuestions=questions.filter(q=>q.active!==false&&!cardKeys.has(q.key)&&!isCurrentlyReadingQuestion(q)&&!isShelfQuestion(q)&&!isLegacyProfileFieldKey(q.key)&&(vis[`question:${q.key}`]??q.public_default)!==false).map(q=>({q,value:rawAnswers[q.key]})).filter(({q,value})=>value!==undefined&&value!==null&&(q.type==='image_upload'?answerImageUrls(value).length>0:answerText(value).trim()!==''));
    if(!belowQuestions.length) return <TabEmpty icon={<MessageCircleQuestion aria-hidden="true"/>} text="No more answers shared yet."/>;
    const grouped=[...new Set(belowQuestions.map(({q})=>q.section))].map(section=>({section,items:belowQuestions.filter(({q})=>q.section===section).sort((a,b)=>a.q.sort_order-b.q.sort_order)}));
    return <div className="space-y-5">{grouped.map(group=><div key={group.section} className="space-y-3"><h3 className="text-sm font-bold uppercase tracking-wider" style={{color:'var(--color-cyan-dark)'}}>{({'Reading Identity':'Reading taste','Beyond Books':'Beyond books'} as Record<string,string>)[group.section]||group.section}</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{group.items.map(({q,value})=><article key={q.id} className="rounded-2xl p-4 min-w-0" style={{background:'var(--color-paper)',border:'1px solid var(--color-border)'}}><h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{color:'var(--color-teal-dark)'}}>{sanitizeUserText(q.question,300)}</h4>{q.type==='image_upload'?<div className="grid grid-cols-2 gap-2">{answerImageUrls(value).map((url,i)=>{const safe=safeExternalUrl(url);return safe?<img key={i} src={safe} alt="Reader answer" loading="lazy" className="rounded-xl w-full object-cover"/>:null;})}</div>:<p className="text-sm leading-6 whitespace-pre-wrap break-words">{sanitizeUserText(answerText(value),1200)}</p>}</article>)}</div></div>)}</div>;
  })();
  return <div className="pt-24 pb-20 container-prose animate-fade-in"><div className="max-w-4xl mx-auto space-y-7">
    {(blacklisted||(!isOwn&&!!user))&&<div className="profile-social-actions px-1 sm:px-2 animate-fade-up">{blacklisted&&<span className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-2" style={{background:'rgba(239,68,68,.10)',color:'#b91c1c'}}><AlertTriangle className="w-3.5 h-3.5"/> Profile blacklisted</span>}</div>}
    <div className="relative">
      <ProfileCard header={<FollowStatsBar followers={follow.followers} following={follow.following} hideFollowers={privacy.hide_followers} hideFollowing={privacy.hide_following} isOwn={isOwn} onOpen={openConn}/>} data={cardData} topActions={({replay,replayKey})=><div className="nl-trio" role="group" aria-label="Profile actions">{!isOwn?<button type="button" disabled={busy} onClick={()=>void doFollow()} aria-pressed={follow.is_following} aria-label={`${follow.is_following?'Unfollow':'Follow'}${profile.novelty_username?` @${profile.novelty_username}`:''}`} className={`nl-trio-btn nl-trio-follow ${follow.is_following?'is-following':''}`}>{follow.is_following?<UserCheck aria-hidden="true"/>:<UserPlus aria-hidden="true"/>}<span>{follow.is_following?'Following':'Follow'}</span></button>:null}<button type="button" onClick={replay} className="nl-trio-btn nl-trio-replay" aria-label="Replay animation"><svg key={replayKey} className="nl-ico-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></button>{!isOwn&&user&&<button type="button" onClick={()=>{setReportMessage(null);setReportOpen(true)}} className="nl-trio-btn nl-trio-report" aria-label="Report user" title="Report user"><Flag aria-hidden="true"/></button>}<button type="button" onClick={()=>void shareProfile()} className={`nl-trio-btn nl-trio-share ${shared?'is-done':''}`} aria-label="Share this profile">{shared?<Check aria-hidden="true"/>:<Share2 aria-hidden="true"/>}</button></div>} onFollowersClick={()=>openConn('followers')} initialFormat={asFormatKey((profile.profile_answers||{}).__public_view)||undefined}/>
    </div>
    <ProfileIntro questions={questions} answers={rawAnswers} visibility={vis}/>
    <ProfileHighlights userId={profile.id} isOwn={isOwn}/>
    <ProfileTabs panes={{reading:readingPane,questions:questionsPane,published:<PublishedPanel reviews={published} nlRatingForReview={r=>shelfInfo[r.review_no]?.nlRating??null} renderReview={r=><ReviewCard review={r} navigate={navigate} posterUrl={shelfInfo[r.review_no]?.posterUrl} nlRating={shelfInfo[r.review_no]?.nlRating??null}/>}/>}}/>
    {reportOpen&&<div className="fixed inset-0 z-[100] grid place-items-center p-4 bg-black/45 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={()=>!reportBusy&&setReportOpen(false)}><div className="w-full max-w-lg rounded-3xl p-6" style={{background:'var(--color-paper)',border:'1px solid var(--color-border)'}} onClick={e=>e.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Flag className="w-5 h-5" style={{color:'var(--color-teal-dark)'}}/><h2 className="font-serif text-2xl font-semibold">Report this user</h2></div><p className="text-sm mt-1" style={{color:'var(--color-text-muted)'}}>Choose the closest reason. Reports are reviewed for moderation and repeated reports may trigger automatic blacklisting.</p></div><button type="button" onClick={()=>setReportOpen(false)} disabled={reportBusy}><X className="w-5 h-5"/></button></div><div className="mt-5 space-y-4"><div><label className="label">What should be reported?</label><select value={reportReason} onChange={e=>setReportReason(e.target.value as ReportReason)} className="input-field">{REPORT_REASONS.map(r=><option key={r}>{r}</option>)}</select></div><div><label className="label">Additional details (optional)</label><textarea value={reportDetails} onChange={e=>setReportDetails(e.target.value)} maxLength={2000} className="input-field min-h-28 resize-y" placeholder="Give moderators useful context without sharing unnecessary private information."/></div>{reportMessage&&<p className="text-sm" style={{color:/submitted|blacklisted/i.test(reportMessage)?'var(--color-teal-dark)':'#dc2626'}}>{reportMessage}</p>}<div className="flex gap-2"><button type="button" onClick={()=>setReportOpen(false)} disabled={reportBusy} className="btn-ghost flex-1">Cancel</button><button type="button" disabled={reportBusy} onClick={async()=>{setReportBusy(true);setReportMessage(null);try{const r=await reportUser(profile.id,reportReason,reportDetails);setReportMessage(r.blacklisted?'Report submitted. This profile has reached the automatic blacklist threshold.':'Report submitted. Thank you.');setReportDetails('');}catch(e){setReportMessage(e instanceof Error?e.message:'Could not submit report.')}finally{setReportBusy(false)}}} className="btn-primary flex-1">{reportBusy?'Submitting…':'Submit report'}</button></div></div></div></div>}
    <ConnectionsModal open={connKind} onClose={()=>setConnKind(null)} onKind={openConn} username={profile.novelty_username} counts={{followers:follow.followers,following:follow.following}} hidden={{followers:privacy.hide_followers,following:privacy.hide_following}} isOwn={isOwn} me={user?{id:user.id,username:myProfile?.novelty_username??null}:null} navigate={navigate} onChanged={refreshStats}/>
  </div></div>;
}
function Stat({value,label}:{value:number;label:string}){return <div className="rounded-xl p-3" style={{background:'var(--color-paper)',border:'1px solid var(--color-border)'}}><p className="text-xl font-semibold">{value}</p><p className="text-[10px] uppercase tracking-wider" style={{color:'var(--color-text-muted)'}}>{label}</p></div>}
function Shelf({title,subtitle,reviews,navigate,posterByReviewNo}:{title:string;subtitle:string;reviews:AcceptedReviewCard[];navigate:(path:string)=>void;posterByReviewNo?:Record<string,string|null>}){return <section className="surface-card p-6"><div className="flex items-center justify-between gap-4 mb-5"><div><p className="text-xs uppercase tracking-[.18em] font-semibold" style={{color:'var(--color-teal-dark)'}}>{subtitle}</p><h2 className="font-serif text-2xl font-semibold">{title}</h2></div><CheckCircle className="w-5 h-5" style={{color:'var(--color-cyan-dark)'}}/></div>{reviews.length?<div className="grid md:grid-cols-2 gap-4">{reviews.map(r=><ReviewCard key={r.id} review={r} navigate={navigate} posterUrl={posterByReviewNo?.[r.review_no]}/>)}</div>:<div className="py-8 text-center text-sm" style={{color:'var(--color-text-muted)'}}><BookOpen className="w-8 h-8 mx-auto mb-3"/>No published reviews yet.</div>}</section>}
function ReviewCard({review,navigate,posterUrl,nlRating}:{review:AcceptedReviewCard;navigate:(path:string)=>void;posterUrl?:string|null;nlRating?:number|null}){const cover=(posterUrl||review.book_cover);return <article className="rounded-2xl p-4 flex gap-4 cursor-pointer" onClick={()=>navigate(`/review/${encodeURIComponent(`${review.book_title||'review'}-${review.review_no||''}`)}`)} style={{background:'var(--color-paper)',border:'1px solid var(--color-border)'}}><div className="w-20 h-28 rounded-xl overflow-hidden shrink-0">{cover?<img src={cover} alt="" className="w-full h-full object-cover"/>:<div className="w-full h-full grid place-items-center"><BookOpen className="w-7 h-7"/></div>}</div><div className="min-w-0"><p className="text-xs font-bold" style={{color:'var(--color-cyan-dark)'}}>Review #{review.review_no||'—'}</p><h3 className="font-serif text-lg font-semibold mt-1">{sanitizeUserText(review.book_title, 200)}</h3><p className="text-sm mt-1" style={{color:'var(--color-text-muted)'}}>{sanitizeUserText(review.author, 120)}</p>{nlRating!=null&&Number.isFinite(nlRating)&&nlRating>0&&<span className="inline-flex items-center gap-1.5 mt-2 rounded-lg px-2.5 py-1 text-xs font-bold" style={{background:'rgba(0,151,178,.10)',color:'var(--color-teal-dark)'}}><Star className="w-3.5 h-3.5 fill-current" aria-hidden="true"/>{nlRating.toFixed(1)}<span className="opacity-70 text-[10px] tracking-wider">NL</span></span>}<p className="text-xs mt-2 line-clamp-3" style={{color:'var(--color-text-muted)'}}>{sanitizeUserText(review.review, 800)}</p></div></article>}
