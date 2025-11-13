import { useEffect } from 'react';

export default function DashboardIndex() {
  useEffect(() => {
    window.location.replace('/dashboard/overview');
  }, []);
  return null;
}


