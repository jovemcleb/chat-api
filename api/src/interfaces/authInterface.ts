export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IAuthResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
  };
}
