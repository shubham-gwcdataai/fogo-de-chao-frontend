import { useState } from "react";
import "./App.css";

const API_BASE = "https://fogo-de-chao-backend.onrender.com";

const PLATFORMS = [
  {
    key: "tripadvisor",
    label: "TripAdvisor",
    placeholder: "https://www.tripadvisor.in/Restaurant_Review-g304558-d123456-...",
    hint: "Open the restaurant's own page on TripAdvisor, then copy the URL — it must contain 'Restaurant_Review'.",
  },
  {
    key: "yelp",
    label: "Yelp",
    placeholder: "https://www.yelp.com/biz/restaurant-name",
    hint: "Open the restaurant's own page on Yelp, then copy the URL — it must contain '/biz/'.",
  },
  {
    key: "google_maps",
    label: "Google Maps",
    placeholder: "https://www.google.com/maps/place/Restaurant+Name/@lat,lng,17z/...",
    hint: "Click the restaurant on Google Maps until its reviews panel opens, then copy the URL — it must contain '/place/'. A coordinate viewport or search results URL will not work.",
  },
  {
    key: "open_table",
    label: "OpenTable",
    placeholder: "https://www.opentable.com/r/restaurant-name",
    hint: "Open the restaurant's own page on OpenTable (not search results), then copy the URL — it must contain '/r/'.",
  },
];

const MIN_DATE = "2021-01-01";
const MAX_DATE = new Date().toISOString().split("T")[0];

function StatusGlyph({ status }) {
  if (status === "running") return <span className="glyph glyph-running" aria-label="Running">◐</span>;
  if (status === "done")    return <span className="glyph glyph-done"    aria-label="Done">★</span>;
  if (status === "error")   return <span className="glyph glyph-error"   aria-label="Error">✕</span>;
  return <span className="glyph glyph-idle" aria-label="Idle">☆</span>;
}

export default function App() {
  const [restaurantName, setRestaurantName] = useState("");
  const [location, setLocation]             = useState("");
  const [dateFrom, setDateFrom]             = useState("2021-01-01");
  const [dateTo, setDateTo]                 = useState(MAX_DATE);
  const [urls, setUrls]       = useState({ tripadvisor: "", yelp: "", google_maps: "", open_table: "" });
  const [enabled, setEnabled] = useState({ tripadvisor: true, yelp: true, google_maps: true, open_table: true });
  const [statuses, setStatuses] = useState({ tripadvisor: "idle", yelp: "idle", google_maps: "idle", open_table: "idle" });
  const [results, setResults]   = useState([]);
  const [errors, setErrors]     = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError]       = useState("");

  const toggleEnabled = (key) => setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  const updateUrl     = (key, value) => setUrls((prev) => ({ ...prev, [key]: value }));

  const handleFromChange = (e) => {
    const val = e.target.value;
    setDateFrom(val);
    if (dateTo && val > dateTo) setDateTo(val);
  };

  const handleToChange = (e) => {
    const val = e.target.value;
    setDateTo(val);
    if (dateFrom && val < dateFrom) setDateFrom(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setResults([]);
    setErrors([]);

    const selectedPlatforms = PLATFORMS.filter((p) => enabled[p.key]).map((p) => p.key);

    if (!restaurantName.trim()) {
      setFormError("Enter a restaurant name — it's used to name the output files.");
      return;
    }
    if (!location.trim()) {
      setFormError("Enter a location to narrow results.");
      return;
    }
    if (!dateFrom || !dateTo) {
      setFormError("Select both a start and end date.");
      return;
    }
    if (dateFrom > dateTo) {
      setFormError("Start date must be on or before the end date.");
      return;
    }
    if (selectedPlatforms.length === 0) {
      setFormError("Select at least one platform to harvest.");
      return;
    }
    for (const key of selectedPlatforms) {
      if (!urls[key].trim()) {
        const platform = PLATFORMS.find((p) => p.key === key);
        setFormError(`${platform.label} is selected but has no URL.`);
        return;
      }
    }

    setIsSubmitting(true);
    setStatuses((prev) => {
      const next = { ...prev };
      selectedPlatforms.forEach((key) => (next[key] = "running"));
      return next;
    });

    try {
      const res = await fetch(`${API_BASE}/api/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_name: restaurantName.trim(),
          location:        location.trim(),
          date_from:       dateFrom,
          date_to:         dateTo,
          tripadvisor_url: urls.tripadvisor  || null,
          yelp_url:        urls.yelp         || null,
          google_maps_url: urls.google_maps  || null,
          open_table_url:  urls.open_table   || null,
          platforms:       selectedPlatforms,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setResults(data.results || []);
      setErrors(data.errors   || []);

      setStatuses((prev) => {
        const next = { ...prev };
        (data.results || []).forEach((r)  => (next[r.platform]  = "done"));
        (data.errors  || []).forEach((er) => (next[er.platform] = "error"));
        return next;
      });
    } catch (err) {
      setFormError(err.message || "Something went wrong reaching the backend.");
      setStatuses((prev) => {
        const next = { ...prev };
        selectedPlatforms.forEach((key) => (next[key] = "error"));
        return next;
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadUrl = (filepath) =>
    `${API_BASE}/api/download?filepath=${encodeURIComponent(filepath)}`;

  return (
    <div className="page">
      <header className="masthead">
        <p className="eyebrow">Apify · Review Harvester</p>
        <h1>Pull every review, in one pass.</h1>
        <p className="dek">
          Point it at a restaurant's pages on TripAdvisor, Yelp, and Google Maps.
          It runs the scrapers and hands back a spreadsheet per platform.
        </p>
      </header>

      <form className="ledger" onSubmit={handleSubmit}>

        {/* Restaurant name */}
        <div className="field">
          <label htmlFor="restaurant-name">Restaurant name</label>
          <input
            id="restaurant-name"
            type="text"
            placeholder="The Cheesecake Factory, Atlanta"
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
          />
          <span className="hint">Used to name the output files.</span>
        </div>

        {/* Location */}
        <div className="field">
          <label htmlFor="location">Location</label>
          <input
            id="location"
            type="text"
            placeholder="City, state or country — e.g. Mumbai, India"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <span className="hint">Narrows results to a specific area.</span>
        </div>

        {/* Date range */}
        <div className="field">
          <label>Date range</label>
          <div className="date-range">
            <div className="date-col">
              <span className="date-sublabel">From</span>
              <input
                type="date"
                value={dateFrom}
                min={MIN_DATE}
                max={dateTo || MAX_DATE}
                onChange={handleFromChange}
              />
            </div>
            <span className="date-sep">—</span>
            <div className="date-col">
              <span className="date-sublabel">To</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || MIN_DATE}
                max={MAX_DATE}
                onChange={handleToChange}
              />
            </div>
          </div>
          <span className="hint">Reviews outside this window will be excluded.</span>
        </div>

        {/* Platform rows */}
        <div className="rows">
          {PLATFORMS.map((p) => (
            <div className={`row ${enabled[p.key] ? "" : "row-disabled"}`} key={p.key}>
              <button
                type="button"
                className="row-toggle"
                onClick={() => toggleEnabled(p.key)}
                aria-pressed={enabled[p.key]}
                title={enabled[p.key] ? "Skip this platform" : "Include this platform"}
              >
                <StatusGlyph status={statuses[p.key]} />
              </button>
              <div className="row-body">
                <label htmlFor={`${p.key}-url`}>{p.label}</label>
                <input
                  id={`${p.key}-url`}
                  type="url"
                  placeholder={p.placeholder}
                  value={urls[p.key]}
                  disabled={!enabled[p.key]}
                  onChange={(e) => updateUrl(p.key, e.target.value)}
                />
                {enabled[p.key] && (
                  <span className="hint">{p.hint}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {formError && <p className="form-error">{formError}</p>}

        <button type="submit" className="run-button" disabled={isSubmitting}>
          {isSubmitting ? "Harvesting…" : "Run harvest"}
        </button>
      </form>

      {(results.length > 0 || errors.length > 0) && (
        <section className="output">
          <p className="eyebrow">Results</p>
          {results.map((r) => (
            <div className="output-row" key={r.platform}>
              <span className="glyph glyph-done">★</span>
              <span className="output-label">
                {PLATFORMS.find((p) => p.key === r.platform)?.label} — {r.rows} reviews
              </span>
              <a className="download-link" href={downloadUrl(r.filepath)}>
                Download .xlsx
              </a>
            </div>
          ))}
          {errors.map((er) => (
            <div className="output-row output-row-error" key={er.platform}>
              <span className="glyph glyph-error">✕</span>
              <span className="output-label">
                {PLATFORMS.find((p) => p.key === er.platform)?.label} failed — {er.error}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}