import os
import shutil
from PIL import Image

# Caminhos base
BASE_DIR = r"c:\Users\MegaWare-Servidor\Desktop\UDG-MASTER"
UDG_IMG_DIR = os.path.join(BASE_DIR, "UDG IMG", "UDG IMG")

SOLIC_01 = os.path.join(UDG_IMG_DIR, "SOLIC_01")
SOLIC_02 = os.path.join(UDG_IMG_DIR, "SOLIC_02")
SOLIC_03 = os.path.join(UDG_IMG_DIR, "SOLIC_03")
SOLIC_04 = os.path.join(UDG_IMG_DIR, "SOLIC_04")

# Destinos
SRC_ASSETS = os.path.join(BASE_DIR, "src", "assets")
ROOT_ASSETS = os.path.join(BASE_DIR, "assets")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
PUBLIC_ICONS = os.path.join(PUBLIC_DIR, "icons")

os.makedirs(SRC_ASSETS, exist_ok=True)
os.makedirs(ROOT_ASSETS, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)
os.makedirs(PUBLIC_ICONS, exist_ok=True)

print("Iniciando a atualização de imagens...")

# --- GRUPO 1: LOGOTIPOS (SOLIC_01) ---
print("\n[Grupo 1] Atualizando logotipos...")
logotipos_mapping = {
    "logo.png": ["src/assets/logo.png", "assets/logo.png"],
    "udg-logo-antigo.png.png": ["src/assets/udg-logo-antigo.png"],
    "udg-logo-transparent.png.png": ["src/assets/udg-logo-transparent.png"],
    "udg-logo.png.png": ["src/assets/udg-logo.png"]
}

for src_name, dest_paths in logotipos_mapping.items():
    src_file = os.path.join(SOLIC_01, src_name)
    if os.path.exists(src_file):
        for dest in dest_paths:
            dest_file = os.path.join(BASE_DIR, dest.replace("/", os.sep))
            shutil.copy2(src_file, dest_file)
            print(f"  Copiado: {src_name} -> {dest}")
    else:
        print(f"  Aviso: Arquivo de origem não encontrado: {src_file}")

# --- GRUPO 2: SPLASH SCREENS (SOLIC_02) ---
print("\n[Grupo 2] Atualizando telas de abertura (splash)...")
splash_mapping = {
    "splash.png.png": "assets/splash.png",
    "Design sem nome (5).png": "assets/splash-dark.png"
}

for src_name, dest in splash_mapping.items():
    src_file = os.path.join(SOLIC_02, src_name)
    if os.path.exists(src_file):
        dest_file = os.path.join(BASE_DIR, dest.replace("/", os.sep))
        shutil.copy2(src_file, dest_file)
        print(f"  Copiado: {src_name} -> {dest}")
    else:
        print(f"  Aviso: Arquivo de origem não encontrado: {src_file}")

# --- GRUPO 3: FAVICONS E ÍCONES PWA (SOLIC_03) ---
print("\n[Grupo 3] Atualizando favicons e ícones PWA...")
favicon_bundle_dir = os.path.join(SOLIC_03, "assets", "bundle-cadeado-base-1782439552948", "favicon")

if os.path.exists(favicon_bundle_dir):
    # Copiar pacotes pré-gerados
    fav_mapping = {
        "apple-touch-icon.png": "public/apple-touch-icon.png",
        "favicon-16.png": "public/favicon-16.png",
        "favicon-32.png": "public/favicon-32.png",
        "favicon-48.png": "public/favicon-48.png",
        "favicon.ico": "public/favicon.ico",
        "pwa-192.png": ["public/icon-192.png", "public/icons/icon-192.png"],
        "pwa-512.png": ["public/icon-512.png", "public/icons/icon-512.png"]
    }

    for src_name, dest_paths in fav_mapping.items():
        src_file = os.path.join(favicon_bundle_dir, src_name)
        if os.path.exists(src_file):
            if isinstance(dest_paths, str):
                dest_paths = [dest_paths]
            for dest in dest_paths:
                dest_file = os.path.join(BASE_DIR, dest.replace("/", os.sep))
                shutil.copy2(src_file, dest_file)
                print(f"  Copiado: {src_name} -> {dest}")
        else:
            print(f"  Aviso: Arquivo de origem não encontrado no bundle: {src_file}")
else:
    print(f"  Aviso: Pasta do bundle do favicon não encontrada: {favicon_bundle_dir}")

# Redimensionamento de cadeado-base.png para outros tamanhos
cadeado_base_path = os.path.join(SOLIC_03, "cadeado-base.png")
if os.path.exists(cadeado_base_path):
    print("\n[Grupo 3] Redimensionando cadeado-base.png...")
    img = Image.open(cadeado_base_path)

    resize_targets = {
        "public/icon-1024.png": (1024, 1024),
        "public/icons/icon-1024.png": (1024, 1024),
        "public/icons/icon-256.png": (256, 256),
        "public/icons/icon-180.png": (180, 180),
        "public/icons/icon-167.png": (167, 167),
        "public/icons/icon-152.png": (152, 152),
        "public/icons/icon-144.png": (144, 144),
        "public/icons/icon-128.png": (128, 128),
        "public/icons/icon-96.png": (96, 96),
        "public/icons/icon-72.png": (72, 72),
        "public/icons/icon-64.png": (64, 64),
        "public/icons/icon-48.png": (48, 48),
        "public/icons/icon-32.png": (32, 32),
        "assets/icon.png": (1024, 1024)
    }

    for rel_path, size in resize_targets.items():
        dest_file = os.path.join(BASE_DIR, rel_path.replace("/", os.sep))
        # Redimensiona usando o filtro de alta qualidade Resampling.LANCZOS (ou ANTIALIAS em versões antigas de PIL)
        try:
            resized_img = img.resize(size, Image.Resampling.LANCZOS)
        except AttributeError:
            resized_img = img.resize(size, Image.ANTIALIAS)
        resized_img.save(dest_file, "PNG")
        print(f"  Redimensionado para {size[0]}x{size[1]}: -> {rel_path}")
else:
    print(f"  Aviso: Arquivo cadeado-base.png não encontrado: {cadeado_base_path}")


# --- GRUPO 4: ÍCONES SECUNDÁRIOS (SOLIC_04) ---
print("\n[Grupo 4] Atualizando ícones secundários...")
sec_mapping = {
    "masked-icon.svg.svg": "public/masked-icon.svg",
    "placeholder.svg.svg": "public/placeholder.svg",
    "push-badge.png.png": "public/push-badge.png",
    "push-icon.png.png": "public/push-icon.png"
}

for src_name, dest in sec_mapping.items():
    src_file = os.path.join(SOLIC_04, src_name)
    if os.path.exists(src_file):
        dest_file = os.path.join(BASE_DIR, dest.replace("/", os.sep))
        shutil.copy2(src_file, dest_file)
        print(f"  Copiado: {src_name} -> {dest}")
    else:
        print(f"  Aviso: Arquivo de origem não encontrado: {src_file}")

print("\nProcesso de atualização de imagens concluído com sucesso!")
