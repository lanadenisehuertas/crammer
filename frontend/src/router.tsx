import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Onboarding } from "./pages/Onboarding";
import { Dashboard } from "./pages/Dashboard";
import { DocumentPage } from "./pages/DocumentPage";
import { StudyPage } from "./pages/StudyPage";
import { PracticePage } from "./pages/PracticePage";
import { QuizPage } from "./pages/QuizPage";
import { TypePage } from "./pages/TypePage";
import { MatchPage } from "./pages/MatchPage";
import { StatisticsPage } from "./pages/StatisticsPage";
import { SchedulePage } from "./pages/SchedulePage";
import { UploadPage } from "./pages/UploadPage";

const basename = window.location.pathname.startsWith("/app") ? "/app" : "/";

export const router = createBrowserRouter(
  [
    { path: "/onboarding", element: <Onboarding /> },
    {
      element: <AppShell />,
      children: [
        { path: "/", element: <Dashboard /> },
        { path: "/document/:id", element: <DocumentPage /> },
        { path: "/study/:id", element: <StudyPage /> },
        { path: "/practice/:id", element: <PracticePage /> },
        { path: "/quiz/:id", element: <QuizPage /> },
        { path: "/type/:id", element: <TypePage /> },
        { path: "/match/:id", element: <MatchPage /> },
        { path: "/statistics", element: <StatisticsPage /> },
        { path: "/schedule", element: <SchedulePage /> },
        { path: "/upload", element: <UploadPage /> },
      ],
    },
  ],
  { basename },
);
