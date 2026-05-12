export function LeftPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080808] p-5">
      <div className="flex w-full max-w-[340px] flex-col items-center gap-5 text-center">
        {/* WhereIs? logo — white variant */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 125 568 310"
          width="200"
          className="block"
        >
          <text
            style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '94.3px', fontWeight: 800 }}
            transform="translate(63.43 262.72)"
          >
            <tspan fill="#ec4899" letterSpacing="-0.03em">W</tspan>
            <tspan fill="#ffffff">here</tspan>
            <tspan fill="#ec4899">Is</tspan>
          </text>
          <rect fill="#2a2a2a" x="394.56" y="382.46" width="44.89" height="44.89" />
          <path
            fill="#ec4899"
            d="M523.49,134.95H40.9c-22.59,0-40.9,18.31-40.9,40.9h0v101.05c24.79,0,44.89-20.1,44.89-44.89v-56.16h478.6v115.88h-88.03c-22.59,0-40.9,18.31-40.9,40.9v44.89h44.89v-44.89h88.03c22.59,0,40.9-18.31,40.9-40.9v-111.89c0-24.79-20.1-44.89-44.89-44.89Z"
          />
        </svg>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold text-white">You've left the group.</h1>
          <p className="font-mono text-sm text-[#a0a0a0]">Your data has been deleted.</p>
          <p className="mt-2 font-mono text-sm text-[#a0a0a0]">
            Want back in? Ask a group member to send you an invite.
          </p>
        </div>
      </div>
    </div>
  );
}
