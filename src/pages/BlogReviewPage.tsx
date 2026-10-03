import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, ExternalLink, Globe, Tag, Sparkles } from 'lucide-react';
import { fetchBlogPosts, blogPostDate, reviewParagraphs, upscaleBloggerImage, type BlogPost } from '@/lib/blog';

interface BlogReviewPageProps {
  id: string;
  navigate: (path: string) => void;
}

export function BlogReviewPage({ id, navigate }: BlogReviewPageProps) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchBlogPosts()
      .then((posts) => setPost(posts.find((item) => item.id === id) || null))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="pt-28 pb-20 container-prose">
        <div className="max-w-5xl mx-auto grid md:grid-cols-[280px_1fr] gap-10 animate-pulse">
          <div className="aspect-square rounded-3xl" style={{ background: 'var(--color-paper)' }} />
          <div className="space-y-5">
            <div className="h-4 w-32 rounded" style={{ background: 'var(--color-paper)' }} />
            <div className="h-12 w-4/5 rounded" style={{ background: 'var(--color-paper)' }} />
            <div className="h-4 w-1/2 rounded" style={{ background: 'var(--color-paper)' }} />
            <div className="h-5 w-full rounded" style={{ background: 'var(--color-paper)' }} />
            <div className="h-5 w-11/12 rounded" style={{ background: 'var(--color-paper)' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="pt-32 pb-20 container-prose text-center">
        <p className="text-lg mb-5" style={{ color: 'var(--color-text-muted)' }}>Review not found in the blog archive.</p>
        <button onClick={() => navigate('/reviews')} className="btn-ghost">
          <ArrowLeft className="w-4 h-4" /> Back to Reviews
        </button>
      </div>
    );
  }

  const paragraphs = reviewParagraphs(post);

  return (
    <div className="pt-24 pb-20 animate-fade-in">
      <div className="container-prose">
        <button
          onClick={() => navigate('/reviews')}
          className="inline-flex items-center gap-1.5 text-sm mb-8"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Community Reviews
        </button>

        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 lg:gap-12 items-start">
            <aside className="md:sticky md:top-24">
              <div className="relative aspect-square rounded-3xl overflow-hidden shadow-xl" style={{ background: 'var(--color-paper)' }}>
                {post.thumbnail ? (
                  <img
                    src={upscaleBloggerImage(post.thumbnail)}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center gradient-teal p-6">
                    <span className="font-serif text-3xl text-white/50 text-center">{post.title}</span>
                  </div>
                )}
                <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/90" style={{ color: 'var(--color-teal-dark)' }}>
                  Archive review
                </div>
              </div>
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost w-full mt-4"
              >
                <ExternalLink className="w-4 h-4" /> View original on Blogger
              </a>
            </aside>

            <article>
              <div className="flex flex-wrap gap-2 mb-5">
                <span className="tag"><Sparkles className="w-3 h-3 mr-1" /> Novelty Library archive</span>
                {post.categories.slice(0, 5).map((category) => (
                  <span key={category} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(0,151,178,0.06)', color: 'var(--color-text-muted)' }}>
                    {category}
                  </span>
                ))}
              </div>

              <h1 className="font-serif text-4xl md:text-6xl font-semibold leading-tight tracking-tight text-balance mb-4" style={{ color: 'var(--color-text)' }}>
                {post.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-9 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {new Date(blogPostDate(post)).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> Web archive</span>
                {post.author && <span>By {post.author}</span>}
              </div>

              <div className="review-reader">
                {paragraphs.map((paragraph, index) => (
                  <p key={index} className="leading-[1.9] mb-6 text-[16px] md:text-[17px]" style={{ color: 'var(--color-text)' }}>
                    {paragraph}
                  </p>
                ))}
              </div>

              <div className="mt-10 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4" style={{ background: 'var(--color-paper)', border: '1px solid var(--color-border)' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center gradient-teal shrink-0">
                  <Tag className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-serif font-semibold" style={{ color: 'var(--color-text)' }}>A permanent shelf copy</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    This review is presented inside Novelty Library with its own reading experience. The original Blogger post remains available as the source archive.
                  </p>
                </div>
                <a href={post.url} target="_blank" rel="noopener noreferrer" className="btn-ghost shrink-0">
                  Original post
                </a>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
