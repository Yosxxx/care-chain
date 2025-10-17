import Link from "next/link";

type SidebarLink = {
    name: string;
    href: string;
};

export default function Sidebar({
    links,
    children,
}: {
    links: SidebarLink[];
    children?: React.ReactNode;
}) {
    return (
        <nav className="flex flex-col text-left gap-y-2">
            {children}
            {links.map((link) => (
                <Link
                    key={link.href}
                    href={link.href}
                    className="border px-4 py-2"
                >
                    {link.name}
                </Link>
            ))}
        </nav>
    );
}
