import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';

import Layout from './components/Layout';
import AuthGuard from './components/AuthGuard';
import NotFound from './pages/NotFound/NotFound';
import Login from './pages/Login/Login';
import HomePage from './pages/Home/HomePage';
import CapturePage from './pages/Capture/CapturePage';
import GraphPage from './pages/Graph/GraphPage';
import TagsPage from './pages/Tags/TagsPage';
import ProfilePage from './pages/Profile/ProfilePage';
import GoalsPage from './pages/Goals/GoalsPage';
import FragmentsPage from './pages/Fragments/FragmentsPage';
import FragmentDetailPage from './pages/Fragments/FragmentDetailPage';

const RoutesComponent = () => {
  return (
    <Routes>
      {/* 公开路由 */}
      <Route path="/login" element={<Login />} />

      {/* 鉴权路由 */}
      <Route
        element={
          <AuthGuard>
            <Layout />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/capture" element={<CapturePage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/fragments" element={<FragmentsPage />} />
        <Route path="/fragments/:id" element={<FragmentDetailPage />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default RoutesComponent;
