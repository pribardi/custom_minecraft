# Minecraft Clone

A web-based Minecraft clone built with React, TypeScript, and Three.js, featuring voxel-based gameplay and multiplayer capabilities.

## 🎮 Features

- 3D voxel-based world rendering
- First-person player controls
- Real-time multiplayer gameplay
- Procedurally generated terrain
- Block placement and destruction
- Day/night cycle
- Basic crafting system
- World persistence
- Player inventory system
- Physics and collision detection

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Three.js/React Three Fiber
- **Backend**: Node.js + TypeScript + Express
- **Database**: MongoDB
- **Real-time Communication**: Socket.io
- **Authentication**: JWT
- **Build Tool**: Vite
- **Testing**: Jest + React Testing Library

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- MongoDB (for world persistence)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/minecraft-clone.git
cd minecraft-clone
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory:
```env
VITE_API_URL=http://localhost:3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
# or
yarn build
```

## 🎮 Game Controls

- **W/A/S/D**: Move
- **Space**: Jump
- **Left Click**: Break block
- **Right Click**: Place block
- **E**: Open inventory
- **ESC**: Pause menu
- **Mouse**: Look around
- **1-9**: Select hotbar slot

## 🧪 Running Tests

```bash
npm run test
# or
yarn test
```

## 📁 Project Structure

```
src/
  ├── components/
  │   ├── game/        # 3D game components
  │   ├── ui/          # User interface components
  │   └── common/      # Shared components
  ├── hooks/           # Custom React hooks
  ├── systems/         # Game systems (physics, world gen)
  ├── types/           # TypeScript type definitions
  └── utils/           # Utility functions
```

## 🤝 Contributing

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Minecraft® is a registered trademark of Mojang AB
- Three.js community for 3D rendering support
- React Three Fiber team for React 3D tools

## 🚧 Development Status

This project is currently in active development. See our [Project Requirements Document](PRD.md) for detailed development phases and upcoming features.

## 📞 Contact

For questions or feedback, please open an issue in the GitHub repository.

---
**Note**: This is a fan project created for educational purposes and is not affiliated with Mojang AB or Microsoft.
