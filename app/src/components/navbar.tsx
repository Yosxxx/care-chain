import { IoMdNotificationsOutline } from "react-icons/io";

export default function NavBar() {
  return (
    <nav className="sticky top-0">
      <main className="min-w-[1400px] max-w-[1400px] flex items-center justify-between mx-auto py-5 ">
        <div className="font-bold text-2xl">LOGO</div>
        <div className="">
          <IoMdNotificationsOutline size={28} />
        </div>
      </main>
    </nav>
  );
}
