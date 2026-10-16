import PublicLayout from '@/Layouts/PublicLayout';
import HiringMap from '@/Components/HiringMap';

export default function MapIndex({ companies, areas, sectors, types, experienceBuckets }) {
    return (
        <PublicLayout
            fullHeight
            title="Home"
            description="A live map of who is hiring in Kolkata, where, and at what pay. Every listing links out to the original posting."
        >
            <HiringMap companies={companies} areas={areas} sectors={sectors} types={types} experienceBuckets={experienceBuckets} />
        </PublicLayout>
    );
}
