import { PostcodeData } from "@/lib/types";

interface AmenitiesProps {
  data: PostcodeData;
}

interface AmenityItemProps {
  emoji: string;
  name: string;
  distance: number;
  unit: string;
}

function AmenityItem({ emoji, name, distance, unit }: AmenityItemProps) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
        style={{ backgroundColor: "#FFF3E0" }}
      >
        {emoji}
      </div>
      <p className="text-sm text-gray-600">{name}</p>
      <p className="text-base font-bold" style={{ color: "#E65100" }}>
        {distance} {unit}
      </p>
    </div>
  );
}

export default function Amenities({ data }: AmenitiesProps) {
  const { amenities } = data;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-500">
        Nearest Amenities
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <AmenityItem
          emoji="🛒"
          name="Supermarket"
          distance={amenities.supermarket.distance}
          unit={amenities.supermarket.unit}
        />
        <AmenityItem
          emoji="🏥"
          name="GP / Huisarts"
          distance={amenities.gp.distance}
          unit={amenities.gp.unit}
        />
        <AmenityItem
          emoji="🏫"
          name="Primary School"
          distance={amenities.primarySchool.distance}
          unit={amenities.primarySchool.unit}
        />
      </div>
    </div>
  );
}
