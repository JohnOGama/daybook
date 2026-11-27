export const REPO_URL = 'https://github.com/JohnOGama/daybook';

export const SELF_HOST_STEPS = `git clone ${REPO_URL}.git
pnpm install
pnpm run db:migrate
pnpm run dev`;

export const FEATURES = [
  { mark: '13', title: 'Thirteen tools', text: 'List, Notebook, Book, Vault, Budget, Fitness, Job hunt, Database diagram, Pipelines, Skills, Uptime, Focus and Security.' },
  { mark: '⇄', title: 'Share and edit live', text: 'Invite people by email, see their cursors and avatars as they work, and keep roles per space.' },
  { mark: '●●', title: 'Private by design', text: 'Vault encrypts in your browser. Any space can get its own password, enforced on the server.' },
  { mark: 'AI', title: 'AI only where you ask', text: 'Rewrite a block, read a receipt, improve a skill. Only the text involved is sent, never your whole space.' },
  { mark: 'MCP', title: 'Works with your AI apps', text: 'Let ChatGPT or Claude log food, workouts and weigh-ins into Fitness through MCP.' },
  { mark: '◐', title: 'Light and dark', text: 'A calm monochrome look with a keyboard-friendly focus ring, and reduced motion respected.' },
];

export const FAQ = [
  { question: 'Is Daybook really open source?', answer: 'Yes. The code is on GitHub and you can run it on your own server.' },
  { question: 'Where is my data stored?', answer: 'In Postgres. Self-hosting keeps it on your own database. Vault items are encrypted in your browser before they leave it.' },
  { question: 'Can I share a space?', answer: 'Yes. Invite people by email as viewers or editors. Vault is never shared.' },
  { question: 'What does the AI see?', answer: 'Only the text you ask it to work on, such as one block, one receipt or one skill. It is off unless you add an API key.' },
  { question: 'Can I contribute?', answer: 'Yes. Open an issue or a pull request on GitHub. Each tool has its own spec in the docs folder.' },
];

export const TOOL_SHOTS = [
  { value: 'list', label: 'List', alt: 'The List tool: a day of tasks with status, priority and a progress bar.' },
  { value: 'kanban', label: 'Kanban', alt: 'The Kanban view with To do, In progress, On hold and Completed columns.' },
  { value: 'notebook', label: 'Notebook', alt: 'The Notebook tool: a page with a heading, a checklist and a code block.' },
  { value: 'budget', label: 'Budget', alt: 'The Budget overview: balance, income, spending and recent entries.' },
  { value: 'uptime', label: 'Uptime', alt: 'The Uptime tool: three sites with status, response time and a 24-hour strip.' },
];
