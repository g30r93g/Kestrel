export interface Owner {
  login: string;
  name: string;
  type: "user" | "org";
  avatarUrl: string;
}

export interface Repo {
  name: string;
  owner: string;
  private: boolean;
}
