import React from 'react';
import { LeetCodeDashboard } from '../components/LeetCodeDashboard';

interface PlacementsViewProps {
  drives?: any[];
  dsaTopics?: any[];
  student?: any;
}

export const PlacementsView: React.FC<PlacementsViewProps> = () => {
  return (
    <div className="page-container">
      <LeetCodeDashboard />
    </div>
  );
};

export default PlacementsView;
