import { redirect } from "next/navigation";
import { signIn, signUp } from "@/app/actions";
import { FeedbackMessage } from "@/components/feedback-message";
import { SubmitButton } from "@/components/form-buttons";
import { getCurrentUser } from "@/lib/supabase-server";

type LoginPageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (user) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <section className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-2">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-medium uppercase text-teal-700">
            Inventario TI
          </p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
            Acesse para operar ativos por tenant
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">
            A sessao Supabase ativa as policies RLS para leitura e gravacao dos
            dados permitidos ao usuario.
          </p>
        </div>

        <div className="grid gap-4">
          <FeedbackMessage success={params.success} error={params.error} />
          <AuthForm
            title="Entrar"
            action={signIn}
            buttonLabel="Entrar"
            helper="Use um usuario ja criado no Supabase Auth."
          />
          <AuthForm
            title="Criar conta"
            action={signUp}
            buttonLabel="Cadastrar"
            helper="A conta ainda precisa ser vinculada a um tenant."
          />
        </div>
      </section>
    </main>
  );
}

type AuthFormProps = {
  title: string;
  action: (formData: FormData) => Promise<void>;
  buttonLabel: string;
  helper: string;
};

function AuthForm({ title, action, buttonLabel, helper }: AuthFormProps) {
  return (
    <form action={action} className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{helper}</p>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          E-mail
          <input
            name="email"
            type="email"
            required
            className="h-11 rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-zinc-700">
          Senha
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="h-11 rounded-md border border-zinc-300 px-3 text-sm font-normal text-zinc-900"
          />
        </label>
        <SubmitButton
          label={buttonLabel}
          pendingLabel="Processando..."
          className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        />
      </div>
    </form>
  );
}
