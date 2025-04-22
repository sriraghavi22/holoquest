# HoloQuest: Escape the Unseen

## Overview
### Project Concept
*HoloQuest: Escape the Unseen* is an innovative web-based 3D escape room game designed for a hackathon, blending immersive gameplay with cutting-edge technology. Inspired by sci-fi narratives, players find themselves trapped in a holographic lab overseen by a cryptic entity known as "The Overseer." The core challenge is to solve the Gravity Lock Terminal puzzle—aligning a set number of orbiting orbs within a time limit—to unlock the exit and escape. This project was born from a desire to address limited engagement in traditional games by offering dynamic, adaptive experiences, with plans to integrate AI for personalized difficulty in future iterations.

### Vision and Goals
The vision for HoloQuest is to create an engaging, accessible escape room that leverages modern web technologies to deliver a unique player experience. Key goals include:
- **Immersion:** A 3D environment with interactive elements to draw players into the game world.
- **Innovation:** Use of hand gestures and voice commands as intuitive controls, reducing reliance on traditional input devices.
- **Adaptability:** Future AI integration to adjust puzzle complexity based on player skill, enhancing replayability.
- **Hackathon Success:** Demonstrate technical prowess and creativity to stand out in a competitive setting.

## Features
### Backend
- **Core Functionality:** Built with Node.js and MongoDB, the backend manages player sessions, tracks progress (time taken, mistakes), and stores puzzle states. It provides RESTful APIs to initiate games, fetch puzzle details, and process solutions.
- **Puzzle Generation:** Dynamically creates Gravity Lock Terminal puzzles with 2-4 orbs, varying difficulty levels, and time limits.
- **Player Tracking:** Records session IDs, solved puzzles, and performance metrics for a personalized experience.

### Frontend
- **3D Environment:** Rendered with Three.js, featuring a simple cubic room, a terminal, and interactive orbs that players can select and align.
- **Controls:** 
  - **Hand Gestures:** Uses handtrack.js to detect hand movements (point to select, fist to align) via webcam.
  - **Voice Commands:** Implements the Web Speech API for commands like "select orb 1," "align," and "submit."
- **User Interface:** Real-time updates with a timer, status messages, and a clue display overlaid on the 3D scene.

### Integration
- The frontend communicates with the backend via HTTP requests, fetching initial puzzle data and submitting solutions, ensuring a seamless game flow.

### Future Enhancements
- **AI-Driven Puzzles:** Incorporate reinforcement learning (e.g., DQN or PPO) to adapt difficulty based on player performance.
- **Multiplayer Mode:** Allow collaborative or competitive play.
- **Mobile Optimization:** Enhance accessibility for mobile devices.

## Project Development Journey
### Phase 1: Backend Setup (Completed)
- **Objective:** Establish a foundation for game logic and data management.
- **Achievements:** Set up an Express server, connected to MongoDB, and implemented a basic `/game/start` endpoint to generate and save initial puzzles.
- **Challenges:** Initial MongoDB connection issues due to lock file conflicts were resolved by clearing `mongod.lock` and ensuring proper directory setup.

### Phase 2: Core Backend (Completed)
- **Objective:** Expand functionality with player tracking and puzzle solving.
- **Achievements:** Added `/game/puzzle/:id` to fetch puzzle details and `/game/puzzle/:id/solve` to validate solutions. Integrated player models to track progress.
- **Challenges:** Debugged a 500 "Failed to fetch puzzle" error caused by an ECONNREFUSED issue, fixed by ensuring server and MongoDB were running concurrently.

### Phase 3: Frontend Development (Completed)
- **Objective:** Build an interactive 3D interface with innovative controls.
- **Achievements:** Created a Three.js-based 3D scene, added hand gesture and voice command controls, and connected it to the backend for full gameplay.
- **Challenges:** Overcame initial rendering issues (e.g., cube not displaying) by focusing on orb interactions and UI, and resolved WebSocket connection failures by simplifying the setup.

## Getting Started

### Prerequisites
- **Node.js**: Version 14.x or higher ([nodejs.org](https://nodejs.org/)).
- **MongoDB**: Version 4.x or higher ([mongodb.com](https://www.mongodb.com/try/download/community)).
- **Git**: For version control ([git-scm.com](https://git-scm.com/)).
- **Web Browser**: Chrome or Firefox (for WebGL and Web Speech API support).
- **Webcam/Microphone**: Required for hand and voice controls.

### Installation
1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/HoloQuest.git
   cd HoloQuest
