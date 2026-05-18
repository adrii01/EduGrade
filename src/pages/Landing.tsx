import React, { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, ShieldCheck, BarChart3, Clock, ArrowRight, Mail, Lock, User, CheckCircle2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import Logo from '@/src/components/layout/Logo';

export default function Landing() {
  const { user, signIn, signInWithEmail, signUpWithEmail, loading } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (user && !user.emailVerified && user.providerData.some(p => p.providerId === 'password')) {
      if (mode !== 'verify') setMode('verify');
    }
  }, [user, mode]);

  if (loading) return null;
  
  // If user is authenticated and verified (or google user), redirect
  if (user && (user.emailVerified || user.providerData.every(p => p.providerId !== 'password'))) {
    return <Navigate to="/dashboard" />;
  }

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      await signIn();
    } catch (error: any) {
      toast.error('Error al iniciar sesión con Google: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, name);
        setMode('verify');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error en la autenticación');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Left Side: Branding & Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[80%] h-[80%] border-[40px] border-border rounded-full" />
          <div className="absolute bottom-[20%] left-[-10%] w-[40%] h-[40%] border-[20px] border-border rounded-full" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <Logo variant="inverted" />
          </div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-md"
          >
            <h2 className="text-5xl font-display font-bold text-white leading-tight mb-6">
              La excelencia académica comienza con una gran gestión.
            </h2>
            <p className="text-indigo-100 text-lg font-medium leading-relaxed mb-12">
              Únete a miles de educadores que han transformado su aula con herramientas de análisis en tiempo real y comunicación simplificada.
            </p>

            <div className="space-y-6">
              {[
                { icon: BarChart3, title: 'Análisis Visual', desc: 'Gráficos de rendimiento por alumno y clase.' },
                { icon: ShieldCheck, title: 'Datos Seguros', desc: 'Privacidad garantizada bajo estándares europeos.' },
                { icon: Clock, title: 'Ahorro de Tiempo', desc: 'Automatiza el pase de lista y el cálculo de notas.' }
              ].map((item, i) => (
                <motion.div 
                  key={i} 
                  className="flex gap-4 items-start"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.3 }}
                >
                  <div className="w-10 h-10 bg-card/10 rounded-lg flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">{item.title}</h4>
                    <p className="text-indigo-200 text-sm">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 text-indigo-200 text-xs font-bold uppercase tracking-wider">
          © 2026 EduGrade Systems • El estándar en gestión educativa
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[440px]"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <Logo className="scale-125 mb-4" />
            <h1 className="text-xl font-bold font-display mt-2 text-foreground text-center">
              La excelencia académica comienza aquí.
            </h1>
            <p className="text-muted-foreground text-sm font-medium mt-1 text-center">
              Gestiona tu aula como un profesional.
            </p>
          </div>

          <div className="bg-card rounded-[2rem] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-border">
            <AnimatePresence mode="wait">
              {mode === 'verify' ? (
                <motion.div
                  key="verify"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center"
                >
                  <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Verifica tu correo</h2>
                  <p className="text-muted-foreground mb-8 text-sm">Hemos enviado un enlace a <span className="font-bold text-foreground">{email}</span>. Por favor, confírmalo para acceder a EduGrade.</p>
                  
                  <div className="space-y-3">
                    <Button 
                      className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90"
                      onClick={async () => {
                        setIsSubmitting(true);
                        try {
                          await user?.reload();
                          if (user?.emailVerified) {
                            toast.success('¡Verificado correctamente!');
                          } else {
                            toast.error('El correo aún no ha sido verificado.');
                          }
                        } catch (err) {
                          toast.error('Error al comprobar verificación');
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Comprobando...' : 'Ya he verificado'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full h-12 rounded-xl text-muted-foreground"
                      onClick={() => setMode('login')}
                    >
                      Volver al inicio de sesión
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-foreground">
                      {mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {mode === 'login' ? 'Accede a tu panel docente profesional' : 'Comienza a organizar tus cursos hoy'}
                    </p>
                  </div>

                  <form onSubmit={handleEmailAuth} className="space-y-4">
                    {mode === 'register' && (
                      <div className="space-y-1.5">
                        <Label htmlFor="name">Nombre Completo</Label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                          <Input 
                            id="name" 
                            placeholder="Ej. Prof. María García"
                            className="pl-10 h-12 rounded-xl bg-muted/50 border-border focus:bg-card transition-all shadow-none"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Correo Electrónico</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                        <Input 
                          id="email" 
                          type="email" 
                          placeholder="tu@colegio.com"
                          className="pl-10 h-12 rounded-xl bg-muted/50 border-border focus:bg-card transition-all shadow-none"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="password">Contraseña</Label>
                        {mode === 'login' && <button type="button" className="text-[11px] font-bold text-primary hover:underline uppercase tracking-tighter">¿Olvidaste la clave?</button>}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                        <Input 
                          id="password" 
                          type="password" 
                          placeholder="••••••••"
                          className="pl-10 h-12 rounded-xl bg-muted/50 border-border focus:bg-card transition-all shadow-none"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold transition-all shadow-lg shadow-primary/10 mt-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Procesando...' : (mode === 'login' ? 'Iniciar Sesión' : 'Continuar al registro')}
                      {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                  </form>


                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      <span className="bg-card px-4">O accede con</span>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full h-12 rounded-xl border-border flex gap-3 hover:bg-muted font-bold transition-all"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting}
                  >
                    <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" referrerPolicy="no-referrer" />
                    {isSubmitting && mode === 'login' ? 'Conectando...' : 'Cuenta de Google'}
                  </Button>

                  <p className="mt-8 text-center text-muted-foreground text-sm">
                    {mode === 'login' ? '¿Aún no tienes cuenta docente?' : '¿Ya formas parte de la red?'} {' '}
                    <button 
                      type="button"
                      onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                      className="text-primary font-bold hover:underline"
                    >
                      {mode === 'login' ? 'Crea una ahora' : 'Acceder aquí'}
                    </button>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-8 text-center px-4">
            <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest leading-relaxed">
              Infraestructura digital de confianza para centros educativos
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
