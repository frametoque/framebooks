import postgres from "postgres";
const neon = postgres;

const sql = neon(process.env.DATABASE_URL!);

const TABLE_MAP: Record<string, string> = {
  "web-dev":        "services_webdev",
  "graphic-design": "services_graphic",
  "video-editing":  "services_videoedit",
  "photo-video":    "services_photovideo",
  "saas-products":  "services_saas",
};

const CATEGORY_MAP: Record<string, string> = {
  "web-dev":        "Web Development",
  "graphic-design": "Graphic Design",
  "video-editing":  "Video Editing",
  "photo-video":    "Photography & Videography",
  "saas-products":  "SaaS Products",
};

export type ServiceRow = {
  id: number;
  service_id: string;
  title: string;
  description: string;
  overview: string;
  hero_image: string;
  features: Feature[];
  packages: Package[];
  process: ProcessStep[];
  technologies: string[];
  category: string;
  monthly_price?: string;
  yearly_price?: string;
  demo_url?: string;
};

export type Feature = {
  icon: string;
  title: string;
  description: string;
};

export type Package = {
  tier: string;
  description: string;
  price: string;
  price_yearly?: string;
  popular: boolean;
  duration: string;
  cta: string;
  features: string[];
};

export type ProcessStep = {
  step: number;
  title: string;
  description: string;
};

export type ServiceCard = {
  key: string;
  title: string;
  desc: string;
  price: string;
  img: string;
  link: string;
};

/** Get all services for a category as cards (for listing page) */
export async function getServiceCards(categorySlug: string): Promise<ServiceCard[]> {
  const table = TABLE_MAP[categorySlug];
  if (!table) return [];

  const rows = await sql<ServiceRow[]>`
    SELECT service_id, title, overview, packages, hero_image FROM ${sql(table)} ORDER BY sort_order ASC, id ASC
  `;

  return rows.map((row) => {
    const firstPkg = row.packages?.[0];
    const price = firstPkg?.price ?? "0";
    return {
      key:   row.service_id,
      title: row.title,
      desc:  row.overview,
      price,
      img:   row.hero_image || "/services/eventpulse.png",
      link:  `/services/${categorySlug}/${row.service_id}`,
    };
  });
}

/** Get a single service by slug from all tables */
export async function getServiceBySlug(serviceId: string): Promise<(ServiceRow & { categorySlug: string }) | null> {
  for (const [slug, table] of Object.entries(TABLE_MAP)) {
    const rows = await sql<ServiceRow[]>`
      SELECT * FROM ${sql(table)} WHERE service_id = ${serviceId} LIMIT 1
    `;

    if (rows.length > 0) {
      return {
        ...rows[0],
        category: CATEGORY_MAP[slug],
        categorySlug: slug,
      };
    }
  }
  return null;
}

/** Get a single service by slug from a specific category table */
export async function getServiceBySlugAndCategory(
  serviceId: string,
  categorySlug: string
): Promise<ServiceRow | null> {
  const table = TABLE_MAP[categorySlug];
  if (!table) return null;

  const rows = await sql<ServiceRow[]>`
    SELECT * FROM ${sql(table)} WHERE service_id = ${serviceId} LIMIT 1
  `;

  if (!rows[0]) return null;

  return {
    ...rows[0],
    category: CATEGORY_MAP[categorySlug],
  };
}

/** Get metadata for a service detail page */
export async function getServiceMeta(serviceId: string) {
  const service = await getServiceBySlug(serviceId);
  if (!service) return null;
  return {
    title:        service.title,
    description:  service.description,
    heroImage:    service.hero_image,
    categorySlug: service.categorySlug,
  };
}

export { TABLE_MAP, CATEGORY_MAP };