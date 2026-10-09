import { guideGroups } from '@/lib/guide-content';
import ArticleView from './[slug]/ArticleView';

export const metadata = {
  title: 'User Guide',
  description: 'Learn how to use Framebooks for your business accounting.',
};

export default function GuideIndexPage() {
  const welcomeArticle = guideGroups.flatMap(g => g.articles).find(a => a.slug === 'welcome');
  
  if (!welcomeArticle) return null;

  return <ArticleView article={welcomeArticle} groupTitle="Getting started" />;
}
