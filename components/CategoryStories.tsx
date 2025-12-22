"use client";

type Category = {
  id: string;
  name: string;
  image: string;
};

type Props = {
  categories: Category[];
  activeId: string;
  onSelect: (id: string) => void;
};

export default function CategoryStories({ categories, activeId, onSelect }: Props) {
  return (
    <section className="w-full rounded-[22px] pt-1">
      <div className="mx-auto flex max-w-4xl gap-3 overflow-x-auto px-4 pb-1 sm:justify-center sm:px-6">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className="flex w-20 flex-col items-center gap-2 focus:outline-none"
            aria-pressed={activeId === cat.id}
          >
            <div
              className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 bg-neutral-900 shadow transition-colors ${
                activeId === cat.id ? "border-orange-400" : "border-neutral-800"
              }`}
            >
              <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />
            </div>
            <div className="text-center text-[11px] text-neutral-300">{cat.name}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
