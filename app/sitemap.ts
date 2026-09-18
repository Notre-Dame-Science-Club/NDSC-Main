import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://ndscbd.net";
  
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/activities`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/executives`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/publication`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/olympiad`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/members`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];
}