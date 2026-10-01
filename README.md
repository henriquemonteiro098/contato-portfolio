# MEGλ Studio — Creative Technologist & Gen AI Portfolio

> **MEGλ ($A=\lambda$)** | Portfólio oficial de José Henrique de Souza Monteiro.  
> Uma experiência web de alta fidelidade visual e interativa inspirada na estética do estúdio **[Lusion.co](https://lusion.co/)**, unindo Engenharia de Inteligência Artificial Generativa, Ciência de Dados, Cibersegurança e Desenvolvimento Criativo.

---

## ⚡ Tecnologias & Arquitetura

- **Visual 3D & WebGL:** [Three.js](https://threejs.org/) (r128) com simulação de nuvem de partículas esférica reativa a mouse e scroll, com ruído senoidal dinâmico.
- **Animações & Motion:** [GSAP](https://greensock.com/) (GreenSock Animation Platform) + ScrollTrigger para transições e typography reveal.
- **Áudio Ambiente Interativo:** Web Audio API com sintetizador harmônico ambiental (acorde drone A1/A2/E3 com visualizador de frequências).
- **Cursor Magnético & 3D Tilt:** Efeito de perspectiva tridimensional interativa nos cards de projetos e rastreador de cursor fluido.
- **Tipografia & Design Tokens:** Syne, Space Grotesk e JetBrains Mono em harmonia com paleta dark mode e acentuação esmeralda (`#00ffaa`).

---

## 📁 Estrutura do Projeto

```text
contato2/
├── index.html              # Estrutura semântica e acessível da aplicação
├── style.css               # Design system, micro-interações e layouts responsivos (Bento Grid)
├── main.js                 # Lógica de renderização Three.js, áudio WebAudio e interatividade
├── LICENSE                 # Licença de código aberto MIT
├── README.md               # Documentação técnica do projeto
└── assets/
    ├── Resume_Tech.pdf     # Currículo técnico oficial
    ├── media/
    │   └── reel.mp4        # Showreel cinematográfico em vídeo
    └── projects/
        ├── cinema-arri.jpg
        ├── blue-corridor.jpg
        ├── celestial.jpg
        ├── katana.jpg
        └── portfolio-design.jpg
```

---

## 🚀 Como Executar Localmente

### Opção 1: Servidor Python Simples
```bash
# Clone ou acesse o diretório
cd contato2

# Inicie o servidor local
python3 -m http.server 8080
```
Acesse no seu navegador: `http://localhost:8080`

### Opção 2: Node.js (npx serve)
```bash
npx serve .
```

---

## 👨‍💻 Sobre o Autor

**José Henrique de Souza Monteiro**  
- **GitHub:** [@henriquemonteiro098](https://github.com/henriquemonteiro098)  
- **LinkedIn:** [José Henrique de Souza Monteiro](https://www.linkedin.com/in/jos%C3%A9-henrique-de-souza-monteiro-446480378/)  
- **Email:** `mega.monteiro0908@gmail.com`  
- **Localização:** Porto Alegre - RS, Brasil  

Formações em **Inteligência Artificial Generativa, Dados e Cibersegurança** via DIO (Digital Innovation One) / Fundação Bradesco, SCTEC e SENAI-SC.

---

## 📄 Licença

Este projeto está licenciado sob os termos da licença [MIT](LICENSE).
