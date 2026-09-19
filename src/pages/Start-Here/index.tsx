import { Link } from "react-router-dom";
import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";
import StatusBadge from "../../shared/components/StatusBadge";
import releaseManifest from "../The-Elysia-Archive/releaseManifest.json";
import {
  ecologicalDomains,
  modeCards,
  placePaths,
  publicDestinations,
  roomGroups,
  secondaryDestinations,
  trustWords
} from "./startHereContent";

export default function StartHerePage() {
  return (
    <div className="page-stack start-here-page">
      <PageHero
        eyebrow="Orientation"
        title="Start Here"
        brandMark="standard"
        actions={(
          <>
            <Link className="button-link button-link--primary" to="/archive">Download Elysia</Link>
            <Link className="button-link" to="/build-log">Follow the Build</Link>
          </>
        )}
      >
        <p><strong>New to Elysia? This page explains the whole ecosystem in plain English.</strong></p>
        <p>Elysia is a private, local-first AI companion that runs on your computer. Elysia Ecobotics Online is the public website and community around that work.</p>
        <p>Here you can learn how to use Elysia, understand what stays private, and find the part of the project that fits what you want to do.</p>
        <p className="boundary-note">The public website does not silently read your local Elysia memory, private files, credentials, logs, or machine data.</p>
      </PageHero>

      <section className="section-card" aria-labelledby="start-here-sixty-seconds">
        <div className="start-here-section-heading">
          <p className="eyebrow">First, the names</p>
          <h2 id="start-here-sixty-seconds">The whole thing in 60 seconds</h2>
          <p>Three names describe three different parts of the same larger project.</p>
        </div>

        <div className="feature-grid feature-grid--three">
          <FeatureCard title="Elysia">
            <p>The private local application. You use her for conversation, learning, research, writing, coding, projects, files, analysis, and governed tools.</p>
          </FeatureCard>
          <FeatureCard title="Elysia Ecobotics">
            <p>The larger project connecting responsible AI with research, ecology, technology, robotics, creativity, education, and public-interest work.</p>
          </FeatureCard>
          <FeatureCard title="Elysia Ecobotics Online">
            <p>This public website and community: downloads, research resources, add-ons, developer and artist spaces, discussions, collaboration, project updates, trust information, and participation.</p>
          </FeatureCard>
        </div>

        <div className="two-column start-here-boundary-grid">
          <article className="feature-card start-here-boundary-card">
            <p className="eyebrow">Private</p>
            <h3>Local Elysia</h3>
            <p>Lives primarily on your computer. Conversations, files, projects, memory, local tools, and local identity do not become website data just because you have a Website Account.</p>
          </article>
          <article className="feature-card start-here-boundary-card">
            <p className="eyebrow">Public</p>
            <h3>Elysia Ecobotics Online</h3>
            <p>Lives on the public, cloud-facing website. Anything you deliberately post, submit, upload, message, or pay for here uses the rules of that public service.</p>
          </article>
        </div>

        <p className="boundary-note"><strong>Your local Elysia account and your Website Account are separate.</strong> Do not reuse your local Elysia password on the website.</p>
      </section>

      <section className="section-card" aria-labelledby="start-here-use-elysia">
        <div className="start-here-section-heading">
          <p className="eyebrow">Use the local app</p>
          <h2 id="start-here-use-elysia">How to use Elysia</h2>
          <p>You do not need special prompt syntax. Start normally, then use the extra structure when it helps.</p>
        </div>

        <ol className="start-here-steps">
          <li><strong>Start in Conversations.</strong><span>Tell Elysia what you are trying to accomplish in ordinary language.</span></li>
          <li><strong>Choose a mode when it helps.</strong><span>Modes change how Elysia approaches the work. They do not secretly give her more permissions.</span></li>
          <li><strong>Use a Project for ongoing work.</strong><span>Projects keep related conversations, files, outputs, milestones, and next steps together.</span></li>
          <li><strong>Check the supporting rooms when needed.</strong><span>Memory, Requests, Artifacts, Governance, Capabilities, and Health show what Elysia knows, used, produced, or can do.</span></li>
          <li><strong>Pay attention to boundaries.</strong><span>When Elysia says something is external, sandboxed, blocked, or needs approval, that label is meaningful.</span></li>
        </ol>

        <h3 className="start-here-subheading">Choose the mode that fits the job</h3>
        <div className="feature-grid feature-grid--five">
          {modeCards.map((mode) => (
            <FeatureCard title={mode.title} key={mode.title}>
              <p>{mode.description}</p>
            </FeatureCard>
          ))}
        </div>

        <p className="boundary-note"><strong>The Chamber is Elysia's home and startup view.</strong> It tells you whether the local system is ready before you begin working.</p>

        <h3 className="start-here-subheading">The main rooms</h3>
        <div className="start-here-room-groups">
          {roomGroups.map((group) => (
            <article className="feature-card start-here-room-group" key={group.title}>
              <p className="eyebrow">{group.title}</p>
              <p>{group.description}</p>
              <ul className="start-here-room-list">
                {group.rooms.map((room) => (
                  <li key={room.name}><strong>{room.name}</strong><span>{room.description}</span></li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="small-note">Administrative controls appear only where the user actually has that authority. They are not part of ordinary use.</p>

        <h3 className="start-here-subheading">Words Elysia uses to tell you what is happening</h3>
        <div className="start-here-trust-grid">
          {trustWords.map((item) => (
            <article className="start-here-trust-item" key={item.label}>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card" aria-labelledby="start-here-website-map">
        <div className="start-here-section-heading">
          <p className="eyebrow">The public commons</p>
          <h2 id="start-here-website-map">Where should I go on the website?</h2>
          <p>Each place has a specific job. You do not need to use all of them.</p>
        </div>

        <div className="feature-grid feature-grid--four">
          {publicDestinations.map((destination) => (
            <article className="feature-card start-here-destination-card" key={destination.to}>
              <h3><Link to={destination.to}>{destination.title}</Link></h3>
              <p>{destination.description}</p>
              <p className="start-here-account-note">{destination.account}</p>
              <Link className="button-link" to={destination.to}>Open {destination.title}</Link>
            </article>
          ))}
        </div>

        <h3 className="start-here-subheading">Also explore</h3>
        <div className="start-here-secondary-grid">
          {secondaryDestinations.map((destination) => (
            <article className="start-here-secondary-card" key={destination.to}>
              <h3><Link to={destination.to}>{destination.title}</Link></h3>
              <p>{destination.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card" aria-labelledby="start-here-find-place">
        <div className="start-here-section-heading">
          <p className="eyebrow">Choose by interest</p>
          <h2 id="start-here-find-place">Find your place</h2>
          <p>You do not need to understand the whole ecosystem first. Start with the door closest to what you already care about.</p>
        </div>

        <div className="feature-grid feature-grid--three">
          {placePaths.map((place) => (
            <article className="feature-card start-here-place-card" key={place.title}>
              <h3>{place.title}</h3>
              <p><strong>For:</strong> {place.audience}</p>
              <p>{place.description}</p>
              <div className="button-row">
                {place.actions.map((action) => (
                  <Link
                    className={action.primary ? "button-link button-link--primary" : "button-link"}
                    to={action.to}
                    key={`${place.title}-${action.to}`}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card" aria-labelledby="start-here-ecology">
        <div className="start-here-section-heading">
          <p className="eyebrow">Ecology</p>
          <h2 id="start-here-ecology">The ecological side of Elysia</h2>
          <p>These seven names describe long-term ecological domains in Elysia's architecture. They are <strong>not</strong> seven autonomous AI systems operating today.</p>
        </div>

        <div className="feature-grid feature-grid--four">
          {ecologicalDomains.map((domain) => (
            <article className="feature-card start-here-ecology-card" key={domain.name}>
              <p className="eyebrow">Long-term ecological domain</p>
              <h3>{domain.name} — {domain.plainName}</h3>
              <p>{domain.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card" aria-labelledby="start-here-reality">
        <div className="start-here-section-heading">
          <p className="eyebrow">Reality check</p>
          <h2 id="start-here-reality">How to know what is real right now</h2>
          <p>Elysia changes over time. Instead of trusting an old screenshot or a stale list, use the source that owns the truth you need.</p>
        </div>

        <div className="feature-grid feature-grid--five">
          <FeatureCard title="Archive" tone="safe">
            <p><strong>What version can I actually install?</strong></p>
            <StatusBadge label={`v${releaseManifest.version} ${releaseManifest.channel}`} tone="safe" />
            <p><Link to="/archive">Check the current release</Link></p>
          </FeatureCard>

          <FeatureCard title="Capabilities">
            <p><strong>What can my installed Elysia actually do?</strong></p>
            <p>Open the Capabilities room inside local Elysia.</p>
          </FeatureCard>

          <FeatureCard title="Health">
            <p><strong>Is everything on my machine working right now?</strong></p>
            <p>Open the Health room inside local Elysia.</p>
          </FeatureCard>

          <FeatureCard title="Build Log">
            <p><strong>What is being built, repaired, or changed?</strong></p>
            <p><Link to="/build-log">Follow the public development record</Link></p>
          </FeatureCard>

          <FeatureCard title="Website pages">
            <p><strong>Is a Marketplace, payment, account, or community feature available?</strong></p>
            <p>Trust that feature's own current page and status instead of an old summary.</p>
          </FeatureCard>
        </div>

        <p className="boundary-note">Elysia is deliberately still bounded. Unrestricted shell access, Git automation, silent cloud use, broad autonomous web activity, autonomous ecological intervention, and the future ecological domain systems are not ordinary open-ended powers.</p>

        <div className="start-here-closing">
          <p className="eyebrow">You belong here without needing to be an AI engineer</p>
          <h2>Pick the path that fits what you want to do now.</h2>
          <p>Researchers, programmers, field workers, artists, students, teachers, makers, organizations, and people who simply care about the living world can enter through different doors and still take part in the same commons.</p>
          <p>You can explore the other paths whenever you want.</p>
          <div className="button-row">
            <Link className="button-link button-link--primary" to="/archive">Download Elysia</Link>
            <Link className="button-link" to="/living-library">Browse the Living Library</Link>
            <Link className="button-link" to="/commune">Visit the Commune</Link>
            <Link className="button-link" to="/artisan-collective">Create with the Artisan Collective</Link>
            <Link className="button-link" to="/developer-forge">Build in Developer Forge</Link>
            <Link className="button-link" to="/work-with-elysia-ecobotics">Work With Elysia Ecobotics</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
