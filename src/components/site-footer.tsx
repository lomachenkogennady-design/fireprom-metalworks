export function SiteFooter() {
  return (
    <footer className="app-footer border-t border-line">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6 lg:px-10">
        <p className="micro">
          © {new Date().getFullYear()} ФАЙЕРПРОМ · лазерная резка · гибка · металлоконструкции
        </p>
        <p className="micro">
          fireprom-metalworks portal <span className="text-accent">v1.0</span>
        </p>
      </div>
    </footer>
  );
}
