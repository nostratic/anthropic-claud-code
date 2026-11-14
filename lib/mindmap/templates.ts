import type { LayoutMode, MindMapData } from "./types";
import { createMap, fromOutline } from "./model";

export interface MapTemplate {
  id: string;
  name: string;
  description: string;
  theme: string;
  layout: LayoutMode;
  build: () => MindMapData;
}

const outline = (text: string) => () => fromOutline(text.trim()) ?? createMap();

export const TEMPLATES: MapTemplate[] = [
  {
    id: "blank",
    name: "Blank map",
    description: "Start from a single central idea",
    theme: "classic",
    layout: "mindmap",
    build: () => createMap("Central Idea"),
  },
  {
    id: "brainstorm",
    name: "Brainstorming",
    description: "Collect ideas around a topic",
    theme: "fresh",
    layout: "mindmap",
    build: outline(`
My Topic
  Ideas
    Idea 1
    Idea 2
  Questions
    What problem are we solving?
  Resources
  Next steps
`),
  },
  {
    id: "project",
    name: "Project plan",
    description: "Goals, milestones, tasks and risks",
    theme: "ocean",
    layout: "mindmap",
    build: outline(`
Project Plan
  Goals
    Primary objective
    Success metrics
  Milestones
    Kick-off
    Prototype
    Launch
  Tasks
    [ ] Define scope
    [ ] Assign owners
    [ ] Set timeline
  Team
  Risks
    Budget
    Timeline
`),
  },
  {
    id: "meeting",
    name: "Meeting notes",
    description: "Agenda, discussion and action items",
    theme: "classic",
    layout: "right",
    build: outline(`
Meeting
  Attendees
  Agenda
    Topic 1
    Topic 2
  Decisions
  Action items
    [ ] Follow up
`),
  },
  {
    id: "swot",
    name: "SWOT analysis",
    description: "Strengths, weaknesses, opportunities, threats",
    theme: "sunset",
    layout: "mindmap",
    build: outline(`
SWOT Analysis
  Strengths
  Weaknesses
  Opportunities
  Threats
`),
  },
  {
    id: "org",
    name: "Org chart",
    description: "Top-down hierarchy",
    theme: "mono",
    layout: "org",
    build: outline(`
CEO
  Engineering
    Frontend
    Backend
  Product
    Design
  Operations
    Finance
    People
`),
  },
];

export function getTemplate(id: string | undefined): MapTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
