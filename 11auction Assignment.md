11auction Assignment
Overview
You may choose any one of the project options below and build it end to end.
We expect you to use AI coding tools while building this assignment. The goal is not to prove that you can write every line manually. The goal is to see whether you can use AI well, make good technical decisions, build a real product, debug issues, and ship something clean, usable, and maintainable.
Your submission must include:
A GitHub repository
A hosted live link
A clear README.md
AI coding transcripts or session exports
A short explanation of your architecture, assumptions, and tradeoffs
Frontend design, responsiveness, usability, and polish will be considered during evaluation.
General Requirements
Technical Requirements
Your project must include:
Authentication or user/session identity
Persistent database storage
Clean frontend UI
Seed/demo data or a clear demo flow
Hosted deployment
Basic error handling
Loading and empty states
A clear separation between frontend, backend, database, and realtime logic (if present)
You may use any stack and services/libraries you want, but we recommend staying within the TypeScript ecosystem. Choose tools that make sense for the product.
Hosting Requirements
You must provide a working live URL.
The hosted app should have:
Demo credentials, or
A public demo mode
Code Quality Expectations
Your code should be:
Modular
Readable
Reasonably typed, if your stack supports it
Able to handle basic concurrent use
We do not expect a perfect production system, but we do expect evidence that you understand how production software is shaped.
AI Usage Requirement
You are expected to use AI coding tools such as Codex, Claude Code, Cursor, OpenCode, or similar tools.
Along with your submission, include:
The AI tool or tools used
The main prompts/sessions used
Transcript exports, share links, screenshots, or copied chat logs
A short note explaining where AI helped and where you made manual decisions
You may redact secrets, API keys, personal tokens, and private account details.
Do not fabricate transcripts. We are not judging you for using AI. We are judging how well you directed it.
How To Submit AI Transcripts
Provide a folder in your repo named:
ai-transcripts/
​
Inside it, include exports such as:
ai-transcripts/
  codex-session-1.md
  claude-session-1.txt
  cursor-session-1.md
  opencode-share-links.md
  ai-usage-summary.md
​
Your ai-usage-summary.md should include:
# AI Usage Summary

Tools used:
- Claude Code
- Cursor

What AI helped with:
- Initial architecture
- Realtime implementation
- UI component generation
- Debugging deployment issues

Important manual decisions:
- Chose PostgreSQL because...
- Used WebSockets instead of polling because...
- Changed the AI-generated schema because...

Known limitations:
- ...
​
Examples By Tool
Codex
If using Codex, submit one of:
Exported conversation text or Markdown, if available
Copied session transcript
Screenshots of the main session
Local session JSONL files, if available, commonly under a .codex or ~/.codex/sessions style session directory
Claude Code
Claude Code supports exporting the current conversation with /export. You can save it as a text file and include it in ai-transcripts/.
Claude's documentation also describes local JSONL transcripts under:
~/.claude/projects/<project>/<session-id>.jsonl
​
You may include the exported text file or the JSONL transcript.
Reference: https://code.claude.com/docs/en/sessions
OpenCode
OpenCode supports sharing a conversation with:
/share
​
This creates a share link for the current conversation. Add the links to:
ai-transcripts/opencode-share-links.md
​
Reference: https://opencode.ai/docs
Cursor
If using Cursor, submit one of:
Exported/copied chat or composer history
A screen recording if export is not available in your setup
The minimum expectation is that we can see the major prompts, decisions, and debugging steps.
Project Options
Choose one of the following.
Option 1: AI Memory Journal
Problem Statement
People forget many small but meaningful details from their daily lives. Photos capture some memories, but they often miss the context: who was there, what happened, how the person felt, what decisions were made, and why the day mattered.
Build an AI-powered personal memory journal.
The user should be able to record (by voice) or write a short daily entry. Ideally, this can be a 3-5 minute voice conversation with the AI at the end of the day. The AI should turn that input into a clean, beautiful journal entry.
The app should extract important memories from the conversation and store them in a way that can be searched later.
For example, years later the user should be able to ask:
"When did I first meet Rohan?"
"What did I do on my birthday last year?"
"When did I visit Goa?"
"What was I worried about during my first job interview?"
The AI should answer using stored journal memories, ideally with references to the relevant journal entries.
Core Features
Your app should include:
Daily journal entry creation
Text input, voice input, or both
AI-generated journal summary
Extracted people, places, events, moods, and decisions
Search or chat over past memories
A timeline/calendar view of entries
A visually pleasant journal reading experience
Optional Features
You may add:
AI-generated images or visual cards for journal entries
Mood trends over time
Memory graph of people, places, and events
Private/public entry settings
Tags
Voice transcription
Export to PDF or Markdown
The goal is to build a beautiful, AI-assisted personal memory journal app.
Assumptions To State
In your README, clearly mention assumptions, if any.
Option 2: Mini AI Design Mode
Problem Statement
Many developers can build functional screens, but struggle to make them look polished. Build a small AI design mode tool that helps improve UI screens.
The user should be able to open or upload a web page, and ask the AI to improve it. The best example would be agentation.dev (how we can select components), and how Cursor built it's design mode. The goal is to be able to easily point at components and ask the AI to improve them.
For example:
"Improve the spacing and hierarchy."
"Make this empty state look better."
"Suggest a better mobile layout."
"Make this pricing card more premium."
The app should give useful design suggestions and, where possible, produce updated code, CSS, or a visual preview.
This does not need to be a full Cursor clone. Keep the scope focused and polished.
Core Features
Your app should include:
A page/component/screenshot review interface
AI-generated design feedback
Before/after view
Ability to accept or reject suggestions
Basic code or CSS output
A clean, visual interface
Assumptions To State
In your README, clearly mention assumptions, if any.
Option 3: Mini Realtime Auction Room
Problem Statement
Build a realtime auction room similar in spirit to the auction room experience in iplauction.
This does not need to be sports-specific, but the interaction should feel like a real live auction room: users join a room, the admin starts the auction, one item/player is presented at a time, people bid live, a timer runs, and the item is sold or marked unsold.
The product should feel live, competitive, and reliable. The auction logic should be of the main priority.
Example domains:
Cricket/football fantasy auction
Collectibles auction
Art auction
Sneakers auction
Domain name auction
Office charity auction
The important part is the room experience.
Core Features
Your app should include:
Create auction room
Join room by code/link
Admin and participant roles
Item/player list
Start auction
Current item/player display
Countdown timer
Realtime bidding
Bid history
Sold/unsold outcome
Final results page
Basic room state persistence
Expected Auction Flow
A reasonable flow would be:
LOBBY -> AUCTION -> COMPLETED
​
During the auction:
Only one item/player is active at a time
Users can place bids while the timer is active
Highest bid is visible to everyone
Bid history updates live
Timer expiry resolves the item
Admin can pause/end if needed
Results show who won what and for how much
Optional Features
You may add:
Skip/withdraw voting
Team/squad budgets
Maximum items per user
Role/category caps
Chat/reactions
Public/private rooms
Auction pause/resume
Presence indicators
Spectator mode
Realtime Requirement
Realtime is central to this project.
At minimum:
Bids must update live
Current item/player must update live
Timer state must stay reasonably synced
Results should update without manual refresh
Assumptions To State
In your README, clearly mention assumptions, if any.
Option 4: Watch Together Platform
Problem Statement
Watching videos with friends remotely is harder than it should be. Build a watch-party platform where one user creates a room, adds a YouTube link or video link, invites friends, and everyone watches together.
The video should stay synchronized across users. If one user pauses, resumes, or seeks, the room should update for everyone.
The app should also include realtime chat so people can react while watching.
Core Features
Your app should include:
Create watch room
Join room by link/code
Add YouTube/video URL
Shared video player
Realtime play/pause/seek sync
Realtime chat
Room participants list
Late joiner sync
Basic room persistence
Optional Features
You may add:
Host-only controls
Emoji reactions
Watch queue
User presence
Room history
Private/public rooms
Voice notes
Polls
Start-at-same-time countdown
Mobile-friendly viewing mode
Realtime Requirement
Realtime is central to this project.
At minimum:
Play/pause should sync
Seeking should sync
Chat should update live
Late joiners should enter at the correct timestamp
Multiple users should not permanently desync the room
Assumptions To State
In your README, clearly mention assumptions, if any.
Evaluation Criteria
1. Product Completeness
Does the app solve the stated problem?
Can we use it without the developer explaining every step?
2. Realtime Correctness
Does realtime behavior work across multiple browser sessions?
Does the app remain consistent when users act at the same time?
3. Engineering Quality
Is the code clean, modular, and maintainable?
Are edge cases handled?
4. Frontend Quality
Does the app look good? Responsiveness does not matter — desktop only should do.
Are loading, empty, and error states handled?
Does the UI feel smooth and intentional?
5. Deployment
Is the hosted app working?
Are environment variables documented?
6. AI Usage Quality
Did the candidate use AI effectively?
Did they guide the AI with clear prompts?
Did they review and improve AI-generated code?
Can they explain what they accepted, rejected, and changed?
7. Communication
Can the candidate explain their architecture, tradeoffs, and limitations clearly in a later discussion?
Final Submission Checklist
Your submission should include:
GitHub repository link
Hosted live app link
Demo login credentials or demo instructions
README.md
.env.example
AI transcript folder or links
Architecture/design decision notes
Known limitations
Any test instructions
Example README sections:
# Project Name

## Live Demo

## Demo Credentials

## Tech Stack

## Features

## Architecture

## Realtime Design

## Database Schema

## AI Usage

## Running Locally

## Environment Variables

## Known Limitations

## Future Improvements
​
Follow-Up Round
There may be further interview round(s) where you explain:
Your architecture
Your choices
Your AI usage
Your deployment setup
Tradeoffs you made
What you would improve with more time
Basic walkthrough of the product
