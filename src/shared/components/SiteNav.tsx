import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, Menu, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  publicNavigationTerritories,
  type PublicNavigationDestination
} from "../navigation/publicNavigation";

export const navItems = publicNavigationTerritories.flatMap<PublicNavigationDestination>((territory) => territory.destinations);

function destinationIsActive(pathname: string, destination: string) {
  return pathname === destination || pathname.startsWith(`${destination}/`);
}

function DestinationLink({ destination, onSelect }: {
  destination: PublicNavigationDestination;
  onSelect: () => void;
}) {
  const isBridge = "bridge" in destination;
  return (
    <NavLink
      className="site-nav-destination"
      to={destination.to}
      onClick={onSelect}
    >
      <span className="site-nav-destination__title">
        {destination.label}
        {isBridge && <ExternalLink size={15} aria-hidden="true" />}
      </span>
      <span className="site-nav-destination__description">{destination.description}</span>
      {isBridge && <span className="site-nav-destination__bridge">Separate Elysia portal</span>}
    </NavLink>
  );
}

export default function SiteNav() {
  const location = useLocation();
  const regionRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobileBackRef = useRef<HTMLButtonElement>(null);
  const mobileReturnFocusIdRef = useRef<string | null>(null);
  const mobileTerritoryRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const territoryTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [desktopOpenId, setDesktopOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileTerritoryId, setMobileTerritoryId] = useState<string | null>(null);

  const closeAll = useCallback(() => {
    setDesktopOpenId(null);
    setMobileOpen(false);
    setMobileTerritoryId(null);
  }, []);

  useEffect(() => {
    closeAll();
  }, [closeAll, location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!mobileOpen) return;
    if (mobileTerritoryId) {
      mobileBackRef.current?.focus();
      return;
    }
    const territoryId = mobileReturnFocusIdRef.current;
    if (!territoryId) return;
    mobileTerritoryRefs.current[territoryId]?.focus();
    mobileReturnFocusIdRef.current = null;
  }, [mobileOpen, mobileTerritoryId]);

  useEffect(() => {
    function handleOutsideInteraction(event: PointerEvent) {
      if (regionRef.current?.contains(event.target as Node)) return;
      closeAll();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (desktopOpenId) {
        const trigger = territoryTriggerRefs.current[desktopOpenId];
        setDesktopOpenId(null);
        trigger?.focus();
        return;
      }
      if (mobileOpen) {
        if (mobileTerritoryId) {
          const territoryId = mobileTerritoryId;
          mobileReturnFocusIdRef.current = territoryId;
          setMobileTerritoryId(null);
          return;
        }
        setMobileOpen(false);
        mobileToggleRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handleOutsideInteraction);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideInteraction);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [closeAll, desktopOpenId, mobileOpen, mobileTerritoryId]);

  const mobileTerritory = publicNavigationTerritories.find((territory) => territory.id === mobileTerritoryId) ?? null;

  function openMobileTerritory(territoryId: string) {
    setMobileTerritoryId(territoryId);
  }

  function returnToMobileTerritories() {
    const territoryId = mobileTerritoryId;
    mobileReturnFocusIdRef.current = territoryId;
    setMobileTerritoryId(null);
  }

  return (
    <div className="site-nav-region" ref={regionRef}>
      <nav className="site-nav-desktop" aria-label="Explore Elysia">
        {publicNavigationTerritories.map((territory) => {
          const panelId = `site-nav-panel-${territory.id}`;
          const isOpen = desktopOpenId === territory.id;
          const isActive = territory.destinations.some((destination) => destinationIsActive(location.pathname, destination.to));
          return (
            <div
              className="site-nav-territory"
              data-open={isOpen ? "true" : "false"}
              data-active={isActive ? "true" : "false"}
              key={territory.id}
            >
              <button
                type="button"
                className="site-nav-territory__trigger"
                aria-controls={isOpen ? panelId : undefined}
                aria-expanded={isOpen}
                ref={(node) => { territoryTriggerRefs.current[territory.id] = node; }}
                onClick={() => setDesktopOpenId((current) => current === territory.id ? null : territory.id)}
              >
                <span>{territory.label}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {isOpen && (
                <div className="site-nav-panel" id={panelId}>
                  <div className="site-nav-panel__heading">
                    <span className="site-nav-panel__eyebrow">Explore Elysia</span>
                    <strong>{territory.label}</strong>
                  </div>
                  <div
                    className="site-nav-panel__destinations"
                    data-count={territory.destinations.length}
                  >
                    {territory.destinations.map((destination) => (
                      <DestinationLink
                        destination={destination}
                        key={destination.to}
                        onSelect={closeAll}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <button
        type="button"
        className="site-nav-toggle"
        aria-controls="site-navigation-mobile"
        aria-expanded={mobileOpen}
        ref={mobileToggleRef}
        onClick={() => {
          setMobileOpen((current) => {
            if (current) setMobileTerritoryId(null);
            return !current;
          });
        }}
      >
        {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        <span>{mobileOpen ? "Close navigation" : "Explore Elysia"}</span>
      </button>
      <nav
        id="site-navigation-mobile"
        className="site-nav-mobile"
        data-open={mobileOpen ? "true" : "false"}
        data-view={mobileTerritory ? "destinations" : "territories"}
        aria-label="Elysia Ecobotics Online pages"
      >
        {!mobileTerritory && (
          <div className="site-nav-mobile__territory-view">
            <div className="site-nav-mobile__heading">
              <span className="site-nav-panel__eyebrow">Explore Elysia</span>
              <strong>Choose a territory</strong>
            </div>
            <div className="site-nav-mobile__territories">
              {publicNavigationTerritories.map((territory) => {
                const isActive = territory.destinations.some((destination) => destinationIsActive(location.pathname, destination.to));
                return (
                  <button
                    type="button"
                    className="site-nav-mobile__territory"
                    data-active={isActive ? "true" : "false"}
                    key={territory.id}
                    ref={(node) => { mobileTerritoryRefs.current[territory.id] = node; }}
                    onClick={() => openMobileTerritory(territory.id)}
                  >
                    <span>
                      <strong>{territory.label}</strong>
                      <small>{territory.destinations.length} {territory.destinations.length === 1 ? "destination" : "destinations"}</small>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {mobileTerritory && (
          <div className="site-nav-mobile__destination-view">
            <button
              type="button"
              className="site-nav-mobile__back"
              ref={mobileBackRef}
              onClick={returnToMobileTerritories}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              <span>All territories</span>
            </button>
            <div className="site-nav-mobile__heading">
              <span className="site-nav-panel__eyebrow">Explore Elysia</span>
              <strong>{mobileTerritory.label}</strong>
            </div>
            <div className="site-nav-mobile__destinations">
              {mobileTerritory.destinations.map((destination) => (
                <DestinationLink destination={destination} key={destination.to} onSelect={closeAll} />
              ))}
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}
