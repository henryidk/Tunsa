export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: string;
}

export interface UserWithRole {
  id: string;
  username: string;
  password: string;
  nombre: string;
  telefono: string | null;
  isActive: boolean;
  roleId: string;
  role: { id: string; nombre: string; descripcion: string | null };
  createdAt: Date;
  updatedAt: Date;
}
