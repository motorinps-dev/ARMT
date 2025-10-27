export default function NotFound() {
  return (
    <div className="fixed inset-0 bg-[#050505] overflow-hidden font-['Montserrat',sans-serif] text-white text-[18px]">
      <div className="absolute bottom-0 w-full max-w-[1920px] left-1/2 -translate-x-1/2 animate-slide-up z-50 flex flex-col items-center pb-20">
        <div className="text-[200px] mb-4">🐱</div>
        <h1 className="font-black text-[115px] whitespace-nowrap">
          ОКАК
        </h1>
      </div>
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 text-[750px] font-black leading-none animate-error-slide select-none pointer-events-none z-10">
        404
      </div>

      <style>{`
        @keyframes slide-up {
          0% {
            transform: translate(-50%, 50%);
          }
          100% {
            transform: translate(-50%, 0);
          }
        }

        @keyframes error-slide {
          0% {
            transform: translate(-50%, 800px);
          }
          100% {
            transform: translate(-50%, -400px);
          }
        }

        .animate-slide-up {
          animation: slide-up 1.5s ease forwards;
        }

        .animate-error-slide {
          animation: error-slide 1.5s ease forwards;
        }

        @media (max-width: 1200px) {
          .animate-error-slide {
            font-size: 500px;
          }
        }

        @media (max-width: 768px) {
          .animate-error-slide {
            font-size: 300px;
          }
          h1 {
            font-size: 80px !important;
            bottom: 100px !important;
          }
        }

        @media (max-width: 480px) {
          .animate-error-slide {
            font-size: 200px;
          }
          h1 {
            font-size: 60px !important;
            bottom: 80px !important;
          }
        }
      `}</style>
    </div>
  );
}
