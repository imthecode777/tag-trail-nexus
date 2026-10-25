import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { History, House, Nfc, Settings2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DEFAULT_ESP32_BASE_URL, getEsp32BaseUrl, setEsp32BaseUrl } from "@/lib/esp32";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: House },
  { to: "/register", label: "Register", icon: UserPlus },
  { to: "/history", label: "History", icon: History },
];

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function activeIndexFor(pathname: string): number {
  if (pathname.startsWith("/register")) return 1;
  if (pathname.startsWith("/history")) return 2;
  return 0;
}

function ConnectionSettings() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(DEFAULT_ESP32_BASE_URL);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(getEsp32BaseUrl());
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="ESP32 connection settings"
        >
          <Settings2 className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-4">
        <div className="grid gap-2">
          <Label htmlFor="esp32-base-url">ESP32 base URL</Label>
          <Input
            id="esp32-base-url"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={DEFAULT_ESP32_BASE_URL}
            className="font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Use the IP shown in the ESP32 Serial Monitor. This browser must be on the same network
            as the device.
          </p>
          <Button
            size="sm"
            className="mt-1 justify-self-start rounded-full"
            onClick={() => {
              setEsp32BaseUrl(value);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Navbar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const active = activeIndexFor(pathname);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [pill, setPill] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  useIsoLayoutEffect(() => {
    const update = () => {
      const element = itemRefs.current[active];
      if (element) setPill({ left: element.offsetLeft, width: element.offsetWidth, ready: true });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [active]);

  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav className="glass flex items-center gap-1 rounded-full py-1 pl-2 pr-1.5">
        <span className="ml-1 mr-1 flex size-8 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Nfc className="size-4" />
        </span>
        <div className="relative flex items-center">
          <span
            aria-hidden
            className="absolute inset-y-1 rounded-full bg-primary/20 transition-[left,width,opacity] duration-300 ease-out"
            style={{ left: pill.left, width: pill.width, opacity: pill.ready ? 1 : 0 }}
          />
          {NAV_ITEMS.map((item, index) => (
            <Link
              key={item.to}
              to={item.to}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              className={cn(
                "relative z-10 flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200 sm:px-4",
                index === active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
        </div>
        <ConnectionSettings />
      </nav>
    </header>
  );
}
