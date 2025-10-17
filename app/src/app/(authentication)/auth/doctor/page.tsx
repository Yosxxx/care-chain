"use client";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Logo from "@/components/logo";
import DoctorLogin from "./action";
import { FaUserDoctor } from "react-icons/fa6";

export default function AdminAuth() {
    return (
        <main className="min-h-screen flex flex-col justify-center items-center">
            <Logo />
            <Card className="w-full max-w-md space-y-2">
                <CardHeader>
                    <CardTitle>
                        <div className="p-3 bg-primary/10 rounded-full w-fit m-auto">
                            <FaUserDoctor className="h-8 w-8 text-primary" />
                        </div>
                    </CardTitle>
                    <CardContent className="text-center">
                        <div className="text-2xl font-bold mb-2">
                            Doctor Login
                        </div>
                        <div className="text-sm">
                            Access patient records under hospital custody
                        </div>
                    </CardContent>
                </CardHeader>
                <CardContent>
                    <form action={DoctorLogin} className="flex flex-col gap-5">
                        <div>
                            <Label htmlFor="email" className="mb-2">
                                Email
                            </Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="password" className="mb-2">
                                Password
                            </Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full">
                            <LogIn />
                            Login
                        </Button>
                    </form>
                </CardContent>
                <CardContent>
                    <Separator />
                </CardContent>

                <CardFooter className="text-xs text-muted-foreground justify-center">
                    All access is audited and requires hospital verification.
                </CardFooter>
            </Card>
        </main>
    );
}
