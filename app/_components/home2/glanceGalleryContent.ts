/**
 * The fixed copy for "What We Do at a Glance" — title, description and
 * sizing for all 14 tiles. Per the brief, this content lives in code and
 * only the photo + link are admin-managed (see db/22_migration_..., table
 * glance_gallery). Both the admin page (to label which photo goes where)
 * and the homepage section import this same array, so the copy is never
 * duplicated and can't drift out of sync between the two.
 *
 * `slotKey` must match a `slot_key` row in glance_gallery — that's the
 * join key, not array position, so re-ordering this list is always safe.
 */
export type GlanceItem = {
  slotKey: string;
  small: string;
  title: string;
  /** May contain a single <strong> for one emphasised figure (e.g. "46"). */
  descriptionHtml: string;
  big: boolean;
};

export const GLANCE_ITEMS: GlanceItem[] = [
  {
    slotKey: "workshops",
    small: "WORKSHOPS",
    title: "Organizing Workshops",
    descriptionHtml:
      "We organize hands-on workshops that help students explore science, technology, research, projects, and emerging fields beyond the classroom.",
    big: false,
  },
  {
    slotKey: "project-development",
    small: "PROJECT DEVELOPMENT",
    title: "Developing Science Projects",
    descriptionHtml:
      "We encourage students to turn ideas into working projects through experimentation, problem-solving, prototyping, and practical application.",
    big: false,
  },
  {
    slotKey: "science-podcasts",
    small: "SCIENCE PODCASTS",
    title: "Producing Science Podcasts",
    descriptionHtml:
      "We pioneered the college-level podcast culture in Bangladesh with Elucidation Hour, launching the first college-level podcast in 2020 during the COVID-19 pandemic. The series has featured government officials, professors from universities abroad, established professionals, and NDSC alumni, bringing diverse voices and perspectives to students.",
    big: false,
  },
  {
    slotKey: "science-tech-week",
    small: "NATIONAL SCIENCE & TECHNOLOGY WEEK",
    title: "Organizing Government Festivals",
    descriptionHtml:
      "Organized under the Ministry of Science and Technology, Government of Bangladesh, the National Science & Technology Week has been hosted at Notre Dame College, with NDSC playing a central role in its organization and execution. NDSC has supported the Dhaka District-level observance for <strong>46</strong> editions.",
    big: true,
  },
  {
    slotKey: "science-festivals",
    small: "SCIENCE FESTIVALS",
    title: "Organizing Biggest Annual Festivals",
    descriptionHtml:
      "We pioneered the culture of annual science festivals at the college level in Bangladesh and continue to organize some of the country\u2019s largest college-level science festivals, bringing together students from across the nation.",
    big: true,
  },
  {
    slotKey: "general-knowledge-competitions",
    small: "GENERAL KNOWLEDGE COMPETITIONS",
    title: "Organizing General Knowledge Competitions",
    descriptionHtml:
      "We pioneered college-level General Knowledge Competitions, bringing students together to compete across diverse fields including sports, manga, anime, cinema, literature, Nobel Prizes, history, and world affairs through individual and team-based quizzes. We have organized <strong>35</strong> editions of GKC over 35 years.",
    big: true,
  },
  {
    slotKey: "intra-science-competitions",
    small: "SCIENCE COMPETITIONS",
    title: "Organizing Intra Science Competitions",
    descriptionHtml:
      "We organize and facilitate competitions that challenge students in science, technology, problem-solving, creativity, and knowledge.",
    big: false,
  },
  {
    slotKey: "brainstorming-sessions",
    small: "LEARNING SESSIONS",
    title: "Conducting Brainstorming Sessions",
    descriptionHtml:
      "From scientific concepts to practical skills, our sessions create opportunities for students to learn, interact, and explore new ideas.",
    big: false,
  },
  {
    slotKey: "research-development",
    small: "RESEARCH & DEVELOPMENT",
    title: "Research & Development",
    descriptionHtml:
      "We pioneered the formation of the first dedicated Research & Development team at the college level, fostering scientific inquiry, experimentation, innovation, and collaborative research among students.",
    big: false,
  },
  {
    slotKey: "olympiad-guidance",
    small: "OLYMPIAD GUIDANCE",
    title: "Guiding Olympiad Aspirants",
    descriptionHtml:
      "We conduct seminars, guidance sessions, and preparatory activities to help students pursue science and academic olympiads.",
    big: false,
  },
  {
    slotKey: "scientific-content",
    small: "SCIENCE SUNDAY, STEM INSIGHT",
    title: "Publishing Scientific Content",
    descriptionHtml:
      "We publish Science Sunday every Sunday, featuring well-designed, detailed PDF-based scientific content, alongside STEM Insights \u2014 in-depth articles covering topics for olympiads and other competitions, from core concepts and detailed explanations to mathematical derivations and scientific principles.",
    big: false,
  },
  {
    slotKey: "scientific-tours",
    small: "SCIENTIFIC TOURS",
    title: "Scientific Tours & Visits",
    descriptionHtml:
      "We arrange educational visits and tours that connect students with scientific institutions, facilities, and real-world applications of science.",
    big: false,
  },
  {
    slotKey: "skill-development",
    small: "SKILL DEVELOPMENT",
    title: "Training & Skill Development",
    descriptionHtml:
      "Alongside scientific learning, we develop skills in leadership, teamwork, communication, design, technology, event management, and professional practice.",
    big: false,
  },
  {
    slotKey: "partnerships",
    small: "PARTNERSHIPS",
    title: "Building Strategic Partnerships",
    descriptionHtml:
      "We build partnerships with leading multinational companies, organizations, institutions, and media partners, creating opportunities for our members to develop professional skills, gain real-world experience, and grow through meaningful industry exposure.",
    big: false,
  },
];
