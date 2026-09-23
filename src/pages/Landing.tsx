import React, { useState } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, BarChart3, Clock, ArrowRight, Mail, Lock, User, Sparkles } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import Logo from '@/src/components/layout/Logo';

export default function Landing() {
  const { user, signIn, signInWithEmail, signUpWithEmail, loading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  if (loading) return null;
  
  // Redirect authenticated users directly to dashboard
  if (user) {
    return <Navigate to="/dashboard" />;
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleSubmitting(true);
    try {
      await signIn();
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error(error.message || 'Error al iniciar sesión con Google.');
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Por favor, completa todos los campos.');
      return;
    }

    if (isRegister && !name.trim()) {
      toast.error('Por favor, introduce tu nombre.');
      return;
    }

    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) {
        await signUpWithEmail(email, password, name.trim());
        toast.success('¡Cuenta creada correctamente! Bienvenido a EduGrade.');
      } else {
        await signInWithEmail(email, password);
        toast.success('¡Bienvenido de nuevo!');
      }
    } catch (error: any) {
      let msg = error.message;
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = 'Credenciales incorrectas. Comprueba tu correo y contraseña.';
      } else if (error.code === 'auth/email-already-in-use') {
        msg = 'Este correo electrónico ya está registrado. Prueba a iniciar sesión.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'La contraseña es demasiado débil (mínimo 6 caracteres).';
      }
      toast.error(msg);
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
              Únete a educadores que han transformado su aula con herramientas de análisis en tiempo real, cuadernos digitales y comunicación fluida.
            </p>

            <div className="space-y-6">
              {[
                { icon: BarChart3, title: 'Análisis Visual', desc: 'Gráficos de rendimiento por alumno y clase.' },
                { icon: ShieldCheck, title: 'Datos Seguros', desc: 'Privacidad garantizada bajo estándares europeos.' },
                { icon: Clock, title: 'Ahorro de Tiempo', desc: 'Automatiza el pase de lista y el cálculo de medias ponderadas.' }
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

      {/* Right Side: Login / Register Form */}
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
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground font-display">
                {isRegister ? 'Crear Cuenta Docente' : 'Bienvenido de nuevo'}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {isRegister 
                  ? 'Regístrate para empezar a organizar tus clases' 
                  : 'Introduce tus credenciales para acceder a tu aula'
                }
              </p>
            </div>

            {/* Google Sign-in Button */}
            <Button 
              variant="outline" 
              className="w-full h-12 rounded-xl border-border flex gap-3 bg-card hover:bg-muted/50 font-bold transition-all shadow-sm"
              onClick={handleGoogleSignIn}
              type="button"
              disabled={isGoogleSubmitting || isSubmitting}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              {isGoogleSubmitting ? 'Conectando...' : 'Continuar con Google'}
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <span className="bg-card px-4">O con correo electrónico</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence mode="wait">
                {isRegister && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5 overflow-hidden"
                  >
                    <Label htmlFor="name">Nombre Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                      <Input 
                        id="name" 
                        type="text" 
                        placeholder="Ej. Carmen García"
                        className="pl-10 h-12 rounded-xl bg-muted/50 border-border focus:bg-card transition-all shadow-none"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required={isRegister}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1.5">
                <Label htmlFor="email">Correo Electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="profesor@colegio.es"
                    className="pl-10 h-12 rounded-xl bg-muted/50 border-border focus:bg-card transition-all shadow-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
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
                    minLength={6}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-all shadow-lg shadow-primary/10 mt-2"
                disabled={isSubmitting || isGoogleSubmitting}
              >
                {isSubmitting ? 'Procesando...' : isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
                {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                {isRegister 
                  ? '¿Ya tienes cuenta? Inicia sesión aquí' 
                  : '¿No tienes cuenta? Regístrate gratis'
                }
              </button>
            </div>
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
