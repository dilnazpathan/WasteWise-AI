import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CloudSun,
  Command,
  Download,
  Ellipsis,
  Filter,
  Leaf,
  LogOut,
  Menu,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Sprout,
  TrendingDown,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import AuthPage from "./pages/AuthPage";
import { ApiError, authApi, type AuthUser } from "./services/auth";

type PageId =
  | "overview"
  | "forecast"
  | "inventory"
  | "expiry"
  | "waste"
  | "discounts"
  | "products"
  | "sales"
  | "models";

type Product = {
  name: string;
  category: string;
  sku: string;
  stock: number;
  daily: number;
  price: string;
  status: "Healthy" | "Running low" | "At risk";
};

const products: Product[] = [
  { name: "Organic avocados", category: "Produce", sku: "PRD-1042", stock: 84, daily: 22, price: "$2.49", status: "Healthy" },
  { name: "Whole milk · 1 gal", category: "Dairy", sku: "DAI-0186", stock: 31, daily: 18, price: "$4.29", status: "Running low" },
  { name: "Sourdough loaf", category: "Bakery", sku: "BAK-0240", stock: 19, daily: 14, price: "$5.50", status: "At risk" },
  { name: "Baby spinach", category: "Produce", sku: "PRD-1188", stock: 46, daily: 12, price: "$3.79", status: "Healthy" },
  { name: "Greek yogurt · 500g", category: "Dairy", sku: "DAI-0214", stock: 27, daily: 11, price: "$6.25", status: "Healthy" },
  { name: "Strawberries · 1lb", category: "Produce", sku: "PRD-1093", stock: 13, daily: 16, price: "$4.99", status: "At risk" },
  { name: "Free-range eggs · 12ct", category: "Dairy", sku: "DAI-0163", stock: 56, daily: 9, price: "$6.49", status: "Healthy" },
  { name: "Butter croissant", category: "Bakery", sku: "BAK-0252", stock: 22, daily: 19, price: "$3.25", status: "Running low" },
];

const expiringItems = [
  { name: "Sourdough loaf", detail: "Bakery · Batch #B-2048", quantity: "19 units", days: "Today", color: "rose", discount: "25%" },
  { name: "Strawberries · 1lb", detail: "Produce · Batch #P-1093", quantity: "13 units", days: "Tomorrow", color: "amber", discount: "15%" },
  { name: "Whole milk · 1 gal", detail: "Dairy · Batch #D-0186", quantity: "31 units", days: "In 2 days", color: "amber", discount: "10%" },
];

const sales = [42, 54, 46, 68, 57, 75, 63, 84, 71, 92, 80, 104];
const waste = [52, 43, 47, 38, 45, 32, 35, 29, 36, 23, 27, 19];

const pageTitles: Record<PageId, { title: string; eyebrow: string; subtitle: string }> = {
  overview: { title: "Good morning, Alex", eyebrow: "MONDAY, SEPTEMBER 28", subtitle: "A little less waste makes a lot more good." },
  forecast: { title: "Demand forecast", eyebrow: "PLAN AHEAD", subtitle: "Know what to stock before your shelves tell you." },
  inventory: { title: "Fresh inventory", eyebrow: "YOUR STOCK, AT A GLANCE", subtitle: "Everything fresh, accounted for, and moving." },
  expiry: { title: "Expiry watch", eyebrow: "STAY AHEAD OF THE CLOCK", subtitle: "A little attention today saves a lot tomorrow." },
  waste: { title: "Waste & impact", eyebrow: "GOOD THINGS ADD UP", subtitle: "See your progress toward a lighter footprint." },
  discounts: { title: "Smart discounts", eyebrow: "SAVE IT, SELL IT", subtitle: "Find a better home for items nearing their best-by." },
  products: { title: "Your products", eyebrow: "A FAMILIAR FACE FOR EVERY ITEM", subtitle: "The fresh favorites that keep your shelves moving." },
  sales: { title: "Sales history", eyebrow: "THE BIGGER PICTURE", subtitle: "Find the patterns in what your customers love." },
  models: { title: "Model health", eyebrow: "THE BRAINS BEHIND THE FRESHNESS", subtitle: "A clear view of your forecasting and recommendation models." },
};

const navGroups: { label: string; items: { id: PageId; label: string; icon: typeof Activity; badge?: string }[] }[] = [
  { label: "WORKSPACE", items: [{ id: "overview", label: "Overview", icon: Activity }] },
  {
    label: "FRESH OPERATIONS",
    items: [
      { id: "forecast", label: "Demand forecast", icon: TrendingUp },
      { id: "inventory", label: "Inventory", icon: Boxes, badge: "4" },
      { id: "expiry", label: "Expiry watch", icon: Clock3, badge: "3" },
      { id: "waste", label: "Waste & impact", icon: Sprout },
    ],
  },
  {
    label: "YOUR BUSINESS",
    items: [
      { id: "discounts", label: "Smart discounts", icon: Sparkles },
      { id: "products", label: "Products", icon: Package },
      { id: "sales", label: "Sales history", icon: ShoppingBasket },
      { id: "models", label: "Model health", icon: ShieldCheck },
    ],
  },
];

function Logo() {
  return (
    <div className="brand-lockup">
      <span className="brand-mark"><Leaf size={21} strokeWidth={2.4} /></span>
      <span className="brand-name">waste<span>wise</span></span>
    </div>
  );
}

function StatusPill({ status }: { status: Product["status"] }) {
  const className = status === "Healthy" ? "good" : status === "Running low" ? "warning" : "risk";
  return <span className={`status-pill ${className}`}><span className="status-dot" />{status}</span>;
}

function MiniTrend({ down = false }: { down?: boolean }) {
  return (
    <span className={`trend-chip ${down ? "trend-good" : "trend-up"}`}>
      {down ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
      {down ? "12.4%" : "8.2%"}
    </span>
  );
}

function MetricCard({
  label,
  value,
  unit,
  note,
  icon: Icon,
  tone = "green",
  trend,
}: {
  label: string;
  value: string;
  unit?: string;
  note: string;
  icon: typeof Activity;
  tone?: "green" | "yellow" | "pink" | "blue";
  trend?: "up" | "down";
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span className={`metric-icon ${tone}`}><Icon size={18} strokeWidth={1.9} /></span>
        {trend && <MiniTrend down={trend === "down"} />}
      </div>
      <p className="metric-label">{label}</p>
      <div className="metric-value">{value}<span>{unit}</span></div>
      <p className="metric-note">{note}</p>
    </article>
  );
}

function AreaChart({
  values,
  labels,
  color = "#2e7849",
  id,
}: {
  values: number[];
  labels: string[];
  color?: string;
  id: string;
}) {
  const width = 720;
  const height = 218;
  const padding = { top: 18, right: 12, bottom: 24, left: 12 };
  const max = Math.max(...values) * 1.18;
  const points = values.map((value, index) => {
    const x = padding.left + (index * (width - padding.left - padding.right)) / (values.length - 1);
    const y = height - padding.bottom - (value / max) * (height - padding.top - padding.bottom);
    return [x, y] as const;
  });
  const path = points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const area = `${path} L ${points[points.length - 1][0]} ${height - padding.bottom} L ${points[0][0]} ${height - padding.bottom} Z`;

  return (
    <div className="chart-wrap">
      <svg className="area-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".17" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = padding.top + fraction * (height - padding.top - padding.bottom);
          return <line key={fraction} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#ecefe8" strokeDasharray="3 5" />;
        })}
        <path d={area} fill={`url(#fill-${id})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {points.map(([x, y], index) => index === points.length - 1 ? <circle key={index} cx={x} cy={y} r="5" fill="white" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" /> : null)}
      </svg>
      <div className="chart-labels">{labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
    </div>
  );
}

function ProductTable({ filter }: { filter: string }) {
  const [category, setCategory] = useState("All categories");
  const [sortAsc, setSortAsc] = useState(true);
  const filtered = useMemo(() => {
    const search = filter.trim().toLowerCase();
    return products
      .filter((product) => category === "All categories" || product.category === category)
      .filter((product) => !search || `${product.name} ${product.category} ${product.sku}`.toLowerCase().includes(search))
      .sort((a, b) => sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  }, [category, filter, sortAsc]);

  return (
    <>
      <div className="table-toolbar">
        <label className="select-wrap"><Filter size={15} /><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category"><option>All categories</option><option>Produce</option><option>Dairy</option><option>Bakery</option></select><ChevronDown size={14} /></label>
        <span className="results-count">{filtered.length} items</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr>
            <th><button className="th-sort" onClick={() => setSortAsc(!sortAsc)}>PRODUCT <ChevronDown size={13} /></button></th>
            <th>CATEGORY</th><th>SKU</th><th>IN STOCK</th><th>DAILY SALES</th><th>PRICE</th><th>STATUS</th><th />
          </tr></thead>
          <tbody>
            {filtered.map((product) => <tr key={product.sku}>
              <td><div className="product-cell"><span className={`product-thumb ${product.category.toLowerCase()}`}>{product.category === "Dairy" ? "🥛" : product.category === "Bakery" ? "🥖" : "🥑"}</span><span className="product-name">{product.name}</span></div></td>
              <td><span className="category-label">{product.category}</span></td><td className="muted-cell">{product.sku}</td>
              <td><strong>{product.stock}</strong><span className="table-unit"> units</span></td><td>{product.daily}<span className="table-unit"> / day</span></td>
              <td>{product.price}</td><td><StatusPill status={product.status} /></td>
              <td><button className="icon-button row-action" aria-label={`More options for ${product.name}`}><MoreHorizontal size={18} /></button></td>
            </tr>)}
            {filtered.length === 0 && <tr><td colSpan={8} className="empty-state">No items match your search.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Dashboard({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const [range, setRange] = useState("Last 30 days");
  const [toast, setToast] = useState("");
  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };
  const last30 = range === "Last 30 days";
  const chartValues = last30 ? sales : range === "Last 7 days" ? sales.slice(-7) : sales.map((value) => value * 1.42);
  const chartLabels = last30 ? ["Aug 30", "Sep 2", "Sep 5", "Sep 8", "Sep 11", "Sep 14", "Sep 17", "Sep 20", "Sep 23", "Sep 26", "Sep 29", "Today"] : range === "Last 7 days" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Jul 1", "Jul 8", "Jul 15", "Jul 22", "Jul 29", "Aug 5", "Aug 12", "Aug 19", "Aug 26", "Sep 2", "Sep 9", "Today"];
  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">{pageTitles.overview.eyebrow}<span className="eyebrow-divider" /><span className="live-tag"><span /> ALL SYSTEMS FRESH</span></div>
          <h1>{pageTitles.overview.title}<span className="wave">✳</span></h1>
          <p className="page-subtitle">{pageTitles.overview.subtitle}</p>
        </div>
        <button className="button button-dark" onClick={() => flash("Your fresh inventory report is ready to export.")}><Download size={16} /> Export report</button>
      </div>

      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-kicker"><Sparkles size={14} /> YOUR WEEKLY GOOD</span>
          <h2>Fresh thinking.<br /><span>Real impact.</span></h2>
          <p>You saved <strong>248 lbs</strong> of food this month. That’s a whole lot of good, kept in circulation.</p>
          <button className="hero-link" onClick={() => onNavigate("waste")}>See your impact <ArrowRight size={16} /></button>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <span className="sun-disc" />
          <span className="hero-leaf leaf-one" /><span className="hero-leaf leaf-two" /><span className="hero-leaf leaf-three" />
          <span className="hero-fruit fruit-one">🥑</span><span className="hero-fruit fruit-two">🍋</span><span className="hero-fruit fruit-three">🍊</span>
          <span className="hero-flower">✳</span><span className="hero-stem" />
        </div>
        <div className="hero-note"><span>↗</span> That’s about 207 meals rescued</div>
      </section>

      <section className="metric-grid" aria-label="Business snapshot">
        <MetricCard label="FOOD SAVED" value="1,284" unit=" lbs" note="vs. 1,036 lbs last month" icon={Sprout} tone="green" trend="up" />
        <MetricCard label="WASTE RATE" value="2.8" unit="%" note="0.6% better than last month" icon={TrendingDown} tone="yellow" trend="down" />
        <MetricCard label="FRESH INVENTORY" value="1,642" note="Across 84 active products" icon={Boxes} tone="blue" />
        <MetricCard label="AT-RISK ITEMS" value="12" note="3 need attention today" icon={Clock3} tone="pink" />
      </section>

      <section className="dashboard-grid">
        <article className="panel sales-panel">
          <div className="panel-heading">
            <div><p className="panel-kicker">THE GOOD IN MOTION</p><h3>Sales & waste trends</h3></div>
            <label className="select-wrap range-select"><CalendarDays size={15} /><select value={range} onChange={(event) => setRange(event.target.value)} aria-label="Chart date range"><option>Last 7 days</option><option>Last 30 days</option><option>Last 90 days</option></select><ChevronDown size={14} /></label>
          </div>
          <div className="chart-summary"><div><span className="chart-legend-dot green-dot" />Sales <strong>$12,840</strong><MiniTrend /></div><div><span className="chart-legend-dot rose-dot" />Waste <strong>2.8%</strong><span className="small-down">↓ 0.6%</span></div></div>
          <AreaChart values={chartValues} labels={chartLabels} id="sales" />
        </article>

        <article className="panel expiry-panel">
          <div className="panel-heading">
            <div><p className="panel-kicker">A LITTLE HEADS-UP</p><h3>Freshness to watch <span className="count-badge">3</span></h3></div>
            <button className="icon-button" onClick={() => onNavigate("expiry")} aria-label="View all expiry alerts"><Ellipsis size={20} /></button>
          </div>
          <div className="expiry-list">
            {expiringItems.map((item) => <div className="expiry-item" key={item.name}>
              <span className={`expiry-symbol ${item.color}`}><Clock3 size={16} /></span>
              <div className="expiry-info"><strong>{item.name}</strong><span>{item.detail}</span><small>{item.quantity} · {item.discount} off suggested</small></div>
              <span className={`expiry-time ${item.color}`}>{item.days}</span>
            </div>)}
          </div>
          <button className="text-link" onClick={() => onNavigate("expiry")}>See all freshness alerts <ArrowRight size={15} /></button>
        </article>
      </section>

      <section className="bottom-grid">
        <article className="panel forecast-panel">
          <div className="panel-heading">
            <div><p className="panel-kicker">LOOKING AHEAD</p><h3>Tomorrow’s top movers</h3></div>
            <button className="text-link" onClick={() => onNavigate("forecast")}>Full forecast <ArrowRight size={15} /></button>
          </div>
          <div className="mover-list">
            {[["🥑", "Organic avocados", "Produce", "↑ 18%", "84 units"], ["🥛", "Whole milk · 1 gal", "Dairy", "↑ 12%", "31 units"], ["🍓", "Strawberries · 1lb", "Produce", "↑ 9%", "13 units"]].map(([emoji, name, category, change, stock]) => <div className="mover-row" key={name}><span className="mover-emoji">{emoji}</span><span className="mover-name"><strong>{name}</strong><small>{category}</small></span><span className="mover-change">{change}</span><span className="mover-stock">{stock} on hand</span></div>)}
          </div>
        </article>
        <article className="impact-card">
          <div className="impact-sparkle"><Sprout size={18} /></div>
          <span className="impact-kicker">LITTLE THINGS, BIG DIFFERENCE</span>
          <h3>Good for your shelves.<br />Even better for your <em>neighborhood.</em></h3>
          <p>Your team has rescued the equivalent of <strong>1,067 meals</strong> this quarter.</p>
          <button onClick={() => onNavigate("waste")}>See the good you’re doing <ArrowRight size={15} /></button>
          <div className="impact-decoration" aria-hidden="true"><Leaf /><Leaf /><Leaf /></div>
        </article>
      </section>
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </>
  );
}

function ForecastPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const [period, setPeriod] = useState("Next 7 days");
  return (
    <>
      <PageHeading page="forecast" action={<button className="button button-dark" onClick={() => onNavigate("inventory")}><ShoppingBasket size={16} /> Review stock</button>} />
      <section className="metric-grid compact-metrics">
        <MetricCard label="EXPECTED DEMAND" value="1,248" unit=" units" note="Across all fresh products" icon={TrendingUp} tone="green" trend="up" />
        <MetricCard label="FORECAST ACCURACY" value="94.2" unit="%" note="Last 30-day backtest" icon={Activity} tone="blue" />
        <MetricCard label="REORDER SUGGESTIONS" value="8" note="Items trending below demand" icon={Truck} tone="yellow" />
        <MetricCard label="POTENTIAL STOCKOUTS" value="2" note="Review these before Thursday" icon={Clock3} tone="pink" />
      </section>
      <section className="panel page-panel chart-page-panel">
        <div className="panel-heading">
          <div><p className="panel-kicker">DEMAND, A LITTLE LESS MYSTERIOUS</p><h3>Predicted sales across your store</h3></div>
          <label className="select-wrap"><CalendarDays size={15} /><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Forecast range"><option>Next 7 days</option><option>Next 14 days</option><option>Next 30 days</option></select><ChevronDown size={14} /></label>
        </div>
        <div className="chart-summary"><div><span className="chart-legend-dot green-dot" />Predicted demand <strong>1,248 units</strong></div><div><span className="chart-legend-dot yellow-dot" />Last week <strong>1,106 units</strong></div></div>
        <AreaChart values={period === "Next 7 days" ? [47, 58, 52, 76, 61, 88, 74, 96, 82, 108, 95, 118] : sales.map((value) => value * 1.2)} labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]} id="forecast" />
        <div className="forecast-insight"><Sparkles size={17} /><span><strong>A good thing to know:</strong> Produce demand is expected to rise 18% this weekend. Consider a small restock of avocados and berries.</span></div>
      </section>
      <section className="panel page-panel table-panel">
        <PanelTitle kicker="READY WHEN YOU ARE" title="Products to keep an eye on" action={<button className="text-link" onClick={() => onNavigate("inventory")}>View inventory <ArrowRight size={15} /></button>} />
        <ProductTable filter="" />
      </section>
    </>
  );
}

function PageHeading({ page, action }: { page: PageId; action?: ReactNode }) {
  const content = pageTitles[page];
  return <div className="page-heading-row"><div><div className="eyebrow">{content.eyebrow}</div><h1>{content.title}</h1><p className="page-subtitle">{content.subtitle}</p></div>{action}</div>;
}

function PanelTitle({ kicker, title, action }: { kicker: string; title: string; action?: React.ReactNode }) {
  return <div className="panel-heading"><div><p className="panel-kicker">{kicker}</p><h3>{title}</h3></div>{action}</div>;
}

function InventoryPage({ onNavigate, search }: { onNavigate: (page: PageId) => void; search: string }) {
  return (
    <>
      <PageHeading page="inventory" action={<button className="button button-dark" onClick={() => onNavigate("products")}><Plus size={16} /> Add a product</button>} />
      <section className="metric-grid compact-metrics">
        <MetricCard label="ACTIVE PRODUCTS" value="84" note="Across 6 fresh categories" icon={Package} tone="green" />
        <MetricCard label="TOTAL ON HAND" value="1,642" unit=" units" note="Estimated value $8,240" icon={Boxes} tone="blue" />
        <MetricCard label="RUNNING LOW" value="4" note="A quick restock could help" icon={TrendingDown} tone="yellow" />
        <MetricCard label="FRESH & READY" value="93" unit="%" note="Looking good today" icon={Sprout} tone="pink" />
      </section>
      <section className="panel page-panel table-panel">
        <PanelTitle kicker="THE FRESH STUFF" title="Inventory overview" action={<button className="button button-quiet"><Download size={15} /> Download</button>} />
        <ProductTable filter={search} />
      </section>
      <div className="bottom-note"><CircleHelp size={16} /> Inventory is a live view of your products. <button onClick={() => onNavigate("expiry")}>See freshness alerts <ArrowRight size={14} /></button></div>
    </>
  );
}

function ExpiryPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  return (
    <>
      <PageHeading page="expiry" action={<button className="button button-dark" onClick={() => onNavigate("discounts")}><Sparkles size={16} /> Find a discount</button>} />
      <section className="expiry-hero">
        <div className="expiry-hero-icon"><CloudSun size={24} /></div>
        <div><span className="panel-kicker">A FRESH START, EVERY DAY</span><h3>3 batches could use a little love.</h3><p>Here are a few easy ways to keep good food moving.</p></div>
        <div className="expiry-hero-stat"><strong>3</strong><span>batches to check</span></div>
      </section>
      <section className="panel page-panel">
        <PanelTitle kicker="FIRST THINGS FIRST" title="Coming up on their best-by" action={<button className="button button-quiet"><CalendarDays size={15} /> Next 7 days <ChevronDown size={14} /></button>} />
        <div className="risk-list">
          {expiringItems.map((item, index) => <article className="risk-row" key={item.name}>
            <span className={`risk-timeline ${item.color}`}><span>{index + 1}</span></span>
            <div className="risk-product"><span className={`product-thumb ${item.color}`}>{index === 0 ? "🥖" : index === 1 ? "🍓" : "🥛"}</span><div><strong>{item.name}</strong><span>{item.detail}</span></div></div>
            <div className="risk-qty"><strong>{item.quantity}</strong><span>left on shelf</span></div>
            <div className={`risk-due ${item.color}`}><Clock3 size={15} />{item.days}</div>
            <span className="discount-suggestion">{item.discount} off suggested</span>
            <button className="button button-quiet" onClick={() => onNavigate("discounts")}>Make a plan <ArrowRight size={14} /></button>
          </article>)}
        </div>
      </section>
      <div className="tip-banner"><span><Sparkles size={17} /></span><p><strong>Small win:</strong> A modest markdown the day before expiry can help more food find a happy home.</p><button onClick={() => onNavigate("discounts")}>Explore discounts <ArrowRight size={14} /></button></div>
    </>
  );
}

function WastePage() {
  const [period, setPeriod] = useState("This month");
  return (
    <>
      <PageHeading page="waste" action={<label className="select-wrap"><CalendarDays size={15} /><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Impact date range"><option>This month</option><option>Last 3 months</option><option>This year</option></select><ChevronDown size={14} /></label>} />
      <section className="impact-banner">
        <div><span className="hero-kicker"><Sprout size={14} /> LOOK AT YOU GO</span><h2>Small steps.<br /><span>Big good.</span></h2><p>Every saved item is a win for your shelves, your neighborhood, and the planet.</p></div>
        <div className="impact-big-stat"><span>FOOD KEPT IN CIRCULATION</span><strong>1,284 <small>lbs</small></strong><p>That’s roughly <b>1,067 meals</b> put to better use.</p></div>
        <div className="impact-orbit" aria-hidden="true"><Leaf size={49} /><span>✳</span></div>
      </section>
      <section className="metric-grid compact-metrics">
        <MetricCard label="WASTE RATE" value="2.8" unit="%" note="Down 0.6% from last month" icon={TrendingDown} tone="green" trend="down" />
        <MetricCard label="FOOD RESCUED" value="248" unit=" lbs" note="Your best month yet" icon={Sprout} tone="yellow" trend="up" />
        <MetricCard label="EST. MEALS SAVED" value="1,067" note="Good food, good homes" icon={ShoppingBasket} tone="blue" />
        <MetricCard label="CARBON AVOIDED" value="412" unit=" kg" note="A lighter footprint, together" icon={Leaf} tone="pink" />
      </section>
      <section className="dashboard-grid waste-grid">
        <article className="panel">
          <PanelTitle kicker="THE TREND IS YOUR FRIEND" title="Waste rate over time" />
          <div className="chart-summary"><div><span className="chart-legend-dot rose-dot" />Waste rate <strong>2.8%</strong><span className="small-down">↓ 0.6%</span></div></div>
          <AreaChart values={waste} labels={["Sep 1", "Sep 3", "Sep 5", "Sep 7", "Sep 9", "Sep 11", "Sep 13", "Sep 15", "Sep 17", "Sep 19", "Sep 21", "Today"]} color="#e18a71" id="waste" />
        </article>
        <article className="panel category-waste">
          <PanelTitle kicker="WHERE WE CAN DO BETTER" title="By fresh category" />
          {[["Produce", "🥑", 38, "2.1%"], ["Dairy", "🥛", 26, "3.4%"], ["Bakery", "🥖", 21, "4.2%"], ["Prepared foods", "🥗", 15, "2.8%"]].map(([name, emoji, value, rate]) => <div className="category-bar-row" key={name}><div className="category-bar-title"><span>{emoji}</span><strong>{name}</strong><small>{rate}</small></div><div className="category-bar-track"><span style={{ width: `${value}%` }} /></div><b>{value}%</b></div>)}
        </article>
      </section>
    </>
  );
}

function DiscountsPage() {
  const [discount, setDiscount] = useState("All suggestions");
  const candidates = [
    { name: "Sourdough loaf", category: "Bakery · 19 units", expiry: "Best by today", original: "$5.50", price: "$4.13", markdown: "25%", margin: "$2.28 / unit", tone: "rose" },
    { name: "Strawberries · 1lb", category: "Produce · 13 units", expiry: "Best by tomorrow", original: "$4.99", price: "$4.24", markdown: "15%", margin: "$1.37 / unit", tone: "amber" },
    { name: "Whole milk · 1 gal", category: "Dairy · 31 units", expiry: "Best by in 2 days", original: "$4.29", price: "$3.86", markdown: "10%", margin: "$1.26 / unit", tone: "green" },
  ];
  return (
    <>
      <PageHeading page="discounts" action={<button className="button button-dark" onClick={() => window.print()}><Download size={16} /> Export plan</button>} />
      <div className="prototype-notice"><Sparkles size={18} /><p><strong>A helpful starting point, not a crystal ball.</strong> These suggestions come from simulated scenarios. Real customer responses may differ, so use your judgment before changing prices.</p><button className="notice-close" aria-label="Dismiss notice"><X size={17} /></button></div>
      <section className="metric-grid compact-metrics">
        <MetricCard label="BATCHES TO REVIEW" value="3" note="All with a fresh plan" icon={Clock3} tone="yellow" />
        <MetricCard label="POTENTIAL TO RECOVER" value="$182" note="Estimated from scenario data" icon={TrendingUp} tone="green" />
        <MetricCard label="SUGGESTED DISCOUNT" value="15" unit="%" note="A starting point for review" icon={Sparkles} tone="blue" />
        <MetricCard label="STILL ABOVE COST" value="3 / 3" note="Suggested prices stay above cost" icon={ShieldCheck} tone="pink" />
      </section>
      <section className="panel page-panel">
        <PanelTitle kicker="GOOD FOOD, BETTER CHANCES" title="Discount ideas to review" action={<label className="select-wrap"><Filter size={15} /><select value={discount} onChange={(event) => setDiscount(event.target.value)} aria-label="Filter discount ideas"><option>All suggestions</option><option>Best by today</option><option>Best by tomorrow</option></select><ChevronDown size={14} /></label>} />
        <div className="discount-list">{candidates.filter((item) => discount === "All suggestions" || item.expiry.toLowerCase().includes(discount.replace("Best by ", "").toLowerCase())).map((item) => <article className="discount-row" key={item.name}>
          <span className={`product-thumb ${item.tone}`}>{item.name.includes("Sourdough") ? "🥖" : item.name.includes("Strawberries") ? "🍓" : "🥛"}</span>
          <div className="discount-product"><strong>{item.name}</strong><span>{item.category}</span><small>{item.expiry}</small></div>
          <div className="discount-price"><span>NOW</span><strong>{item.price}</strong><small><s>{item.original}</s> · {item.markdown} off</small></div>
          <div className="discount-margin"><span>EST. GROSS MARGIN</span><strong>{item.margin}</strong><small>Above unit cost</small></div>
          <button className="button button-quiet" onClick={(event) => { const button = event.currentTarget; button.innerHTML = "Plan saved ✓"; button.classList.add("saved-button"); }}>Save this plan <ArrowRight size={14} /></button>
        </article>)}</div>
        <p className="simulation-footnote"><CircleHelp size={15} /> Margins and discounts are based on simulated scenario data; they’re a prototype, not evidence of actual customer price response.</p>
      </section>
    </>
  );
}

function ProductsPage({ search }: { search: string }) {
  return (
    <>
      <PageHeading page="products" action={<button className="button button-dark" onClick={() => window.alert("Product creation is ready to connect to your inventory system.")}><Plus size={16} /> Add a product</button>} />
      <section className="metric-grid compact-metrics">
        <MetricCard label="ON YOUR SHELVES" value="84" note="A colorful little community" icon={Package} tone="green" />
        <MetricCard label="FRESH CATEGORIES" value="6" note="Produce, dairy & more" icon={Boxes} tone="blue" />
        <MetricCard label="TOP SELLER" value="Avocados" note="Your customers’ favorite" icon={TrendingUp} tone="yellow" />
        <MetricCard label="NEEDS A LOOK" value="4" note="Low stock or close to expiry" icon={Clock3} tone="pink" />
      </section>
      <section className="panel page-panel table-panel">
        <PanelTitle kicker="THE GOOD STUFF" title="All products" action={<button className="button button-quiet"><Filter size={15} /> Filters <ChevronDown size={14} /></button>} />
        <ProductTable filter={search} />
      </section>
    </>
  );
}

function SalesPage() {
  const [period, setPeriod] = useState("Last 30 days");
  return (
    <>
      <PageHeading page="sales" action={<button className="button button-quiet" onClick={() => window.print()}><Download size={15} /> Export history</button>} />
      <section className="metric-grid compact-metrics">
        <MetricCard label="NET SALES" value="$38,420" note="vs. $35,510 previous period" icon={TrendingUp} tone="green" trend="up" />
        <MetricCard label="UNITS SOLD" value="5,284" note="Across your fresh selection" icon={ShoppingBasket} tone="blue" trend="up" />
        <MetricCard label="AVG. DAILY SALES" value="$1,281" note="A healthy daily rhythm" icon={Activity} tone="yellow" />
        <MetricCard label="RETURN CUSTOMERS" value="68" unit="%" note="They keep coming back" icon={Sprout} tone="pink" />
      </section>
      <section className="panel page-panel">
        <div className="panel-heading"><div><p className="panel-kicker">THE STORY IN YOUR SALES</p><h3>Sales over time</h3></div><label className="select-wrap"><CalendarDays size={15} /><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Sales date range"><option>Last 7 days</option><option>Last 30 days</option><option>Last 90 days</option></select><ChevronDown size={14} /></label></div>
        <div className="chart-summary"><div><span className="chart-legend-dot green-dot" />Net sales <strong>$38,420</strong><MiniTrend /></div><div><span className="chart-legend-dot yellow-dot" />Units sold <strong>5,284</strong></div></div>
        <AreaChart values={period === "Last 7 days" ? sales.slice(-7) : period === "Last 30 days" ? sales : sales.map((value) => value * 1.6)} labels={["Sep 1", "Sep 3", "Sep 5", "Sep 7", "Sep 9", "Sep 11", "Sep 13", "Sep 15", "Sep 17", "Sep 19", "Sep 21", "Today"]} id="sales-history" />
      </section>
      <section className="panel page-panel table-panel">
        <PanelTitle kicker="A FEW CUSTOMER FAVORITES" title="Best-selling products" />
        <ProductTable filter="" />
      </section>
    </>
  );
}

function ModelsPage() {
  const modelRows = [
    { name: "Demand forecasting", detail: "Next-day product demand", score: "73.8%", metric: "R² score", state: "Ready", symbol: TrendingUp, type: "regression" },
    { name: "Expiry risk", detail: "Batch-level risk classification", score: "94.1%", metric: "ROC-AUC", state: "Ready", symbol: ShieldCheck, type: "classification" },
    { name: "Food waste", detail: "Next-day waste estimate", score: "92.3%", metric: "Exact match", state: "Needs care", symbol: Sprout, type: "regression" },
    { name: "Discount planner", detail: "Simulated gross-margin scenarios", score: "94.8%", metric: "Choice match", state: "Prototype", symbol: Sparkles, type: "prototype" },
  ];
  return (
    <>
      <PageHeading page="models" action={<button className="button button-quiet" onClick={() => window.alert("Model reports are up to date.")}><Activity size={15} /> Refresh status</button>} />
      <div className="model-note"><CircleHelp size={17} /><span>Scores are measured on holdout data. They help compare models, but don’t guarantee future results.</span></div>
      <section className="model-grid">{modelRows.map((model) => {
        const Icon = model.symbol;
        return <article className="panel model-card" key={model.name}>
          <div className="model-top"><span className="metric-icon green"><Icon size={19} /></span><span className={`model-state ${model.type}`}>{model.state}</span></div>
          <h3>{model.name}</h3><p>{model.detail}</p>
          <div className="model-score"><strong>{model.score}</strong><span>{model.metric}</span></div>
          <div className="model-meta"><span>Evaluation type</span><strong>{model.type === "classification" ? "Classification" : "Regression"}</strong></div>
          {model.name === "Food waste" && <div className="model-caveat">The target is mostly zero. Non-zero waste events weren’t detected in the holdout.</div>}
          {model.name === "Discount planner" && <div className="model-caveat">Scenario data is simulated, not real customer response.</div>}
        </article>;
      })}</section>
      <section className="panel page-panel model-info-panel">
        <PanelTitle kicker="GOOD DATA MAKES GOOD DECISIONS" title="A note on these models" />
        <p>Forecast and waste models use date-ordered holdouts. The expiry risk classifier is scored on later inventory snapshots. Discount recommendations are tested with batches held out as groups, so a batch’s scenarios stay together.</p>
      </section>
    </>
  );
}

function App() {
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem("wastewise.access_token"));
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(() => !localStorage.getItem("wastewise.access_token"));
  const [authError, setAuthError] = useState("");
  const [activePage, setActivePage] = useState<PageId>("overview");
  const [search, setSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const page = pageTitles[activePage];

  useEffect(() => {
    if (!authToken) {
      setAuthReady(true);
      return;
    }

    let mounted = true;
    authApi.me(authToken)
      .then((user) => {
        if (mounted) {
          setAuthUser(user);
          setAuthError("");
          setAuthReady(true);
        }
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        if (error instanceof ApiError && error.status === 401) {
          localStorage.removeItem("wastewise.access_token");
          setAuthToken(null);
          setAuthUser(null);
          setAuthError("Your session expired. Sign in again to continue.");
        } else {
          setAuthError(
            error instanceof Error
              ? error.message
              : "We couldn’t verify your session. Please try again.",
          );
        }
        setAuthReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [authToken]);

  const signOut = () => {
    localStorage.removeItem("wastewise.access_token");
    setAuthToken(null);
    setAuthUser(null);
    setAuthError("");
    setActivePage("overview");
  };

  if (!authReady) {
    return <main className="auth-loading"><span className="brand-mark"><Leaf size={21} /></span><p>Checking your WasteWise session...</p></main>;
  }

  if (!authUser) {
    return (
      <AuthPage
        initialMessage={authError}
        onAuthenticated={(token, user) => {
          localStorage.setItem("wastewise.access_token", token);
          setAuthUser(user);
          setAuthToken(token);
          setAuthError("");
        }}
      />
    );
  }

  const navigate = (id: PageId) => {
    setActivePage(id);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top"><Logo /><button className="mobile-close icon-button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
        <button className="workspace-switcher"><span className="workspace-avatar">G</span><span><strong>Goodness Grocer</strong><small>Neighborhood market</small></span><ChevronDown size={15} /></button>
        <nav className="side-nav" aria-label="Main navigation">{navGroups.map((group) => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map((item) => {
          const Icon = item.icon;
          return <button className={`nav-item ${activePage === item.id ? "active" : ""}`} key={item.id} onClick={() => navigate(item.id)}><Icon size={18} strokeWidth={1.85} /><span>{item.label}</span>{item.badge && <span className={`nav-badge ${item.id === "expiry" ? "nav-badge-alert" : ""}`}>{item.badge}</span>}</button>;
        })}</div>)}</nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-tip"><span className="tip-leaf"><Leaf size={17} /></span><p><strong>Good things grow here.</strong><br />Your team saved 248 lbs this month. Keep it up!</p><button onClick={() => navigate("waste")}>See your impact <ArrowRight size={13} /></button></div>
        <button className="nav-item settings-item" onClick={() => navigate("models")}><Settings2 size={18} /><span>Settings & models</span><ChevronRight size={15} /></button>
        <button className="sidebar-profile" onClick={signOut} aria-label={`Sign out ${authUser.name}`} title="Sign out"><span className="profile-avatar">{authUser.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><span><strong>{authUser.name}</strong><small>{authUser.role.replace(/_/g, " ")}</small></span><LogOut size={16} /></button>
      </aside>

      {mobileNavOpen && <button className="mobile-backdrop" aria-label="Close navigation overlay" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{page.title.replace(", Alex", "")}</strong></div></div>
          <div className="topbar-tools">
            <label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." aria-label="Search products" /><kbd><Command size={12} /> K</kbd></label>
            <div className="notification-wrap"><button className="icon-button notification-button" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notifications"><Bell size={19} /><span className="notification-dot" /></button>{notificationsOpen && <div className="notification-popover"><strong>You’re all caught up</strong><span>No new freshness alerts right now.</span></div>}</div>
            <button className="help-button" onClick={() => window.alert("Need a hand? Your WasteWise team is here to help.")}><CircleHelp size={18} /><span>Help</span></button>
          </div>
        </header>
        <div className="page-content">
          {activePage === "overview" && <Dashboard onNavigate={navigate} />}
          {activePage === "forecast" && <ForecastPage onNavigate={navigate} />}
          {activePage === "inventory" && <InventoryPage onNavigate={navigate} search={search} />}
          {activePage === "expiry" && <ExpiryPage onNavigate={navigate} />}
          {activePage === "waste" && <WastePage />}
          {activePage === "discounts" && <DiscountsPage />}
          {activePage === "products" && <ProductsPage search={search} />}
          {activePage === "sales" && <SalesPage />}
          {activePage === "models" && <ModelsPage />}
          <footer className="page-footer"><span>Made with a little more care <span className="footer-heart">♥</span></span><span>WasteWise © 2026 <span className="footer-dot">·</span> Keep good food moving.</span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;