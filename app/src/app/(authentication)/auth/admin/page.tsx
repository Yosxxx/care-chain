/* eslint-disable react/jsx-no-comment-textnodes */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center font-architekt">
      <form action="" className="min-w-md max-w-md font-bold">
        <div className="p-5 border">// ADMIN LOGIN ░░░░░░░░░░░░░░░░░░░░░░░</div>
        <div className="flex flex-col gap-y-5 p-5 border-b border-l border-r">
          <div>
            <Label className="mb-2 font-bold">EMAIL ADDRESS</Label>
            <Input />
          </div>
          <div>
            <Label className="mb-2 font-bold">Password</Label>
            <Input />
          </div>
          <div className="flex flex-col gap-y-5">
            <Button variant={"outline"} className="font-bold">
              Passwordless Login
            </Button>
            <Button className="font-bold">Login</Button>
          </div>
          <div className="font-inter text-sm text-muted-foreground font-normal">
            Want to become apart of CareChain?{" "}
            <Link href={"#"} className="text-black">
              Register.
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
