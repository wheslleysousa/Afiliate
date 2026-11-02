#!/data/data/com.termux/files/usr/bin/bash
# Build do Afiliate Android, direto no Termux. Não modifica o worker ou dados do usuário.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

die() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }
step() { printf '\n===== %s =====\n' "$*"; }

step "Conferindo ambiente"
for cmd in node npm java javac aapt2; do
  command -v "$cmd" >/dev/null 2>&1 || die "Falta o comando $cmd. Revise seu ambiente Termux antes de compilar."
done

if [ -z "${JAVA_HOME:-}" ]; then
  JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
  export JAVA_HOME
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

[ -d "$ANDROID_HOME" ] || die "Android SDK não encontrado em $ANDROID_HOME. Ajuste ANDROID_HOME para a pasta do seu SDK existente."
[ -f "$ANDROID_HOME/platforms/android-36/android.jar" ] || die "SDK Android API 36 ausente em $ANDROID_HOME/platforms/android-36. Confirme os componentes do SDK."

printf 'Node: %s\n' "$(node -v)"
printf 'Java: %s\n' "$(javac -version 2>&1)"
printf 'JAVA_HOME: %s\nANDROID_HOME: %s\n' "$JAVA_HOME" "$ANDROID_HOME"
printf 'AAPT2: %s\n' "$(command -v aapt2)"

step "Dependências JS (somente se necessário)"
if [ ! -x node_modules/.bin/vite ] || [ ! -x node_modules/.bin/cap ]; then
  echo "Instalando dependências; ignorando postinstall de Playwright para não baixar Chromium desnecessário."
  npm install --ignore-scripts --no-audit --no-fund
fi

step "Gerando interface Android com Vite"
# Para o APK, não precisamos executar o bundle server.ts (backend web).
# Build nativo Termux pode falhar com bindings Rollup/Tailwind específicos do Android.
if ! ./node_modules/.bin/vite build; then
  cat >&2 <<'EOF'

O build web falhou. Em Termux ARM64, módulos nativos Rollup,
Tailwind Oxide e LightningCSS podem falhar por bindings incompatíveis.
Envie o PRIMEIRO erro completo para corrigirmos sem apagar node_modules
ou recriar seu ambiente. O APK não foi substituído.
EOF
  exit 1
fi

step "Preparando Android Capacitor"
if [ ! -d android ]; then
  ./node_modules/.bin/cap add android
fi
./node_modules/.bin/cap sync android

# cap sync pode manter o label antigo se android/ já existe.
STRINGS_XML="android/app/src/main/res/values/strings.xml"
if [ -f "$STRINGS_XML" ]; then
  sed -i 's#<string name="app_name">[^<]*</string>#<string name="app_name">afiliate</string>#; s#<string name="title_activity_main">[^<]*</string>#<string name="title_activity_main">afiliate</string>#' "$STRINGS_XML"
fi

[ -f android/gradlew ] || die "Wrapper Gradle não foi gerado. Verifique o erro do cap add/sync."

# Ícone do afiliate vem do próprio GitHub: nenhuma imagem/ZIP é baixada pelo usuário.
BRAND_RESOURCES="$ROOT/resources/android-branding"
[ -f "$BRAND_RESOURCES/mipmap-anydpi-v26/ic_launcher.xml" ] || die "Ícone Android do Afiliate ausente em resources/android-branding."
step "Aplicando logo afiliate e ícone Android"
cp -R "$BRAND_RESOURCES/." "$ROOT/android/app/src/main/res/"

# local.properties é gerado localmente; não versionar caminhos absolutos.
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties

step "Compilando APK com Gradle e AAPT2 do Termux"
(
  cd android
  chmod +x ./gradlew
  ./gradlew --no-daemon -Pandroid.aapt2FromMavenOverride="$(command -v aapt2)" assembleDebug
)

APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
[ -s "$APK" ] || die "Gradle terminou, mas o APK não foi encontrado em $APK."

step "Validando APK"
python - "$APK" <<'PY'
import sys, zipfile
apk = sys.argv[1]
with zipfile.ZipFile(apk) as f:
    names = set(f.namelist())
    required = {'AndroidManifest.xml', 'resources.arsc'}
    missing = required - names
    if missing:
        raise SystemExit(f'APK incompleto; falta: {sorted(missing)}')
print('Estrutura ZIP e recursos básicos do APK: OK')
PY

step "Copiando para Downloads"
OUT=""
if [ -d "$HOME/storage/downloads" ] && [ -w "$HOME/storage/downloads" ]; then
  OUT="$HOME/storage/downloads/afiliate.apk"
elif [ -d "/storage/emulated/0/Download" ] && [ -w "/storage/emulated/0/Download" ]; then
  OUT="/storage/emulated/0/Download/afiliate.apk"
fi
if [ -n "$OUT" ]; then
  cp "$APK" "$OUT"
  printf 'APK pronto: %s\n' "$OUT"
else
  printf 'APK pronto em: %s\n' "$APK"
  echo 'Para copiar para Downloads, conceda armazenamento ao Termux (termux-setup-storage).'
fi
echo 'ATENÇÃO: APK debug pode ter assinatura diferente da versão do GitHub Actions.'
echo 'Não desinstale a versão anterior sem salvar os dados que deseja preservar.'
