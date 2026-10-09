import { guideGroups } from '@/lib/guide-content';
import ArticleView from './ArticleView';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  const articles = guideGroups.flatMap((g) => g.articles);
  return articles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  const article = guideGroups.flatMap((g) => g.articles).find((a) => a.slug === slug);
  if (!article) return { title: 'Not Found | Framebooks' };

  return {
    title: `${article.title} | User Guide | Framebooks`,
    description: article.intro,
  };
}

export default async function GuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  let foundArticle = null;
  let foundGroup = null;

  for (const group of guideGroups) {
    const article = group.articles.find((a) => a.slug === slug);
    if (article) {
      foundArticle = article;
      foundGroup = group;
      break;
    }
  }

  if (!foundArticle || !foundGroup) {
    notFound();
  }

  return <ArticleView article={foundArticle} groupTitle={foundGroup.title} />;
}

