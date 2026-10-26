import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "./components/Shell.tsx";
import { SqueekProvider } from "./data.tsx";
import { BlockTargets } from "./views/BlockTargets.tsx";
import { Hamster } from "./views/Hamster.tsx";
import { SettlementLag } from "./views/SettlementLag.tsx";
import { Sources } from "./views/Sources.tsx";
import { WorkHistory } from "./views/WorkHistory.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <SqueekProvider>
        <Shell>
          <Routes>
            <Route path="/" element={<WorkHistory />} />
            <Route path="/blocks" element={<BlockTargets />} />
            <Route path="/settlement" element={<SettlementLag />} />
            <Route path="/hamster" element={<Hamster />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </SqueekProvider>
    </BrowserRouter>
  );
}
