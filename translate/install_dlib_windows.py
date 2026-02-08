"""Installe dlib sous Windows via une wheel précompilée (sans Visual Studio)."""
import sys
import subprocess

def main():
    v = sys.version_info
    cp = f"cp{v.major}{v.minor}"
    version = "20.0.0"
    url = f"https://github.com/eddiehe99/dlib-whl/releases/download/v{version}/dlib-{version}-{cp}-{cp}-win_amd64.whl"
    print(f"Python {v.major}.{v.minor} -> {cp}")
    print("URL:", url)
    r = subprocess.run([sys.executable, "-m", "pip", "install", url])
    if r.returncode == 0:
        import dlib
        print("OK - dlib", dlib.__version__)
    else:
        print("Echec. Installez Visual Studio Build Tools (C++) puis: pip install dlib")
        print("Ou telechargez une wheel: https://github.com/eddiehe99/dlib-whl/releases")
    return r.returncode

if __name__ == "__main__":
    sys.exit(main())
