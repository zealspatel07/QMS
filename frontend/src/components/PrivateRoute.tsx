import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type Props = {
  allowedRoles?: string[];
  children: React.ReactElement;
};

export default function PrivateRoute({ allowedRoles = [], children }: Props) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // allow any authenticated if no allowedRoles provided
  if (!allowedRoles || allowedRoles.length === 0) return children;

  if (user.role && allowedRoles.includes(user.role)) return children;

  return <Navigate to="/unauthorized" replace />;
}
