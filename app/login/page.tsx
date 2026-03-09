import { AlertTriangle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

const LOGO_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAVqXUvQT7ar2Jj0jBsO8Ugewggd83EXmnPgCO3xNKasjTYNZLq6k1NR_8mqMGA03SotnknB85UxumjYynmwXR18B8BbdrBIDC6Au2tMzMZ3I01tTOWlCp1isNpd_5iNEat6Z5CD6pJlb5OpOSbn0mYDQ_rWauLjgFKKsrG4UJ4Hm6EJnBkZf7v1X7phZCBYpt1hntYeJ4XXfDHro9M2HPpftmO6ZuMEBPEr4nKeEgaNb6L1Z6H5ghz4JRk0TsqpVOT8453JhASeC4";

const errorMap: Record<string, string> = {
  missing_code: "Resposta de autenticacao invalida.",
  invalid_state: "Sessao de login invalida. Tente novamente.",
  inactive_user: "Usuario inativo no cadastro.",
  missing_email: "Conta SSO sem e-mail associado.",
  sso_callback_failed: "Falha no callback SSO.",
};

type LoginPageProps = Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) || {};
  const rawError = params.error;
  const error = typeof rawError === "string" ? rawError : undefined;
  const errorMessage = error ? errorMap[error] || "Falha no login SSO." : null;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f5f7f8]">
      <div className="relative hidden w-1/2 overflow-hidden bg-[#800020]/10 lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-[#800020]/20 via-transparent to-[#800020]/10" />
        <div className="absolute inset-0 flex items-center justify-center opacity-40">
          <svg viewBox="0 0 800 800" className="h-full w-full text-[#800020]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="400" cy="400" r="300" stroke="currentColor" strokeWidth="0.6" strokeDasharray="10 10" />
            <circle cx="400" cy="400" r="200" stroke="currentColor" strokeWidth="1.1" />
            <circle cx="400" cy="400" r="100" stroke="currentColor" strokeWidth="2" />
            <path d="M400 100V700M100 400H700" stroke="currentColor" strokeWidth="0.6" />
            <circle cx="400" cy="100" r="8" fill="currentColor" />
            <circle cx="400" cy="700" r="8" fill="currentColor" />
            <circle cx="100" cy="400" r="8" fill="currentColor" />
            <circle cx="700" cy="400" r="8" fill="currentColor" />
          </svg>
        </div>
        <div className="relative z-10 flex w-full flex-col justify-center px-20">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-white shadow-lg">
              <img src={LOGO_URL} alt="Vision IGA" className="h-full w-full object-contain" />
            </div>
            <span className="text-3xl font-black tracking-tight text-slate-900">Vision IGA</span>
          </div>
          <h1 className="text-5xl font-extrabold leading-tight text-slate-900">Governanca e Identidade em um so lugar.</h1>
          <p className="mt-6 max-w-lg text-xl leading-relaxed text-slate-600">
            Acesse seus sistemas e governe permissoes com seguranca e agilidade na plataforma enterprise.
          </p>
        </div>
        <p className="absolute bottom-10 left-20 z-10 text-sm font-medium uppercase tracking-[0.18em] text-slate-400">Enterprise Security Standard</p>
      </div>

      <div className="flex w-full items-center justify-center bg-white p-8 md:p-16 lg:w-1/2 lg:p-24">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
              <img src={LOGO_URL} alt="Vision IGA" className="h-full w-full object-contain" />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900">Vision IGA</span>
          </div>

          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Bem-vindo de volta</h2>
            <p className="text-slate-500">Entre com autenticacao SSO corporativa.</p>
          </div>

          <form method="get" action="/api/auth/login">
            <Button type="submit" className="h-14 w-full gap-2 text-base font-bold shadow-lg shadow-[#800020]/25">
              <LogIn className="h-5 w-5" />
              Entrar com SSO
            </Button>
          </form>

          {errorMessage ? (
            <div className="flex items-start gap-3 rounded-r-lg border-l-4 border-red-500 bg-red-50 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <p className="font-bold text-red-800">Atencao</p>
                <p className="text-red-700">{errorMessage}</p>
              </div>
            </div>
          ) : null}

          <div className="pt-3 text-xs text-slate-400">
            <p>Use suas credenciais corporativas padrao (Keycloak / SSO).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
