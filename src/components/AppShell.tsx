import NavBar from "./NavBar";
import { type Role } from "@/types";

interface AppShellProps {
  role: Role;
  name: string;
  children: React.ReactNode;
}

export default function AppShell({ role, name, children }: AppShellProps) {
  return (
    <>
      <NavBar role={role} name={name} />
      <main className="sm:ml-56 pt-0 sm:pt-2 pb-20 sm:pb-0 px-4 sm:px-6 max-w-5xl">
        {children}
      </main>
    </>
  );
}
