export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-10 prose">
      <h1>Privacy Policy</h1>

      <p>
        This Privacy Policy describes how <strong>Prausdit Research Lab (PRAUSDIT)</strong> 
        collects, uses, and protects information within its internal developer platform.
      </p>

      <h2>1. Scope</h2>
      <p>
        This platform is strictly intended for internal use by authorized developers 
        and contributors working on PRAUSDIT projects.
      </p>

      <h2>2. Information We Collect</h2>
      <ul>
        <li>Developer account information (name, email, metadata)</li>
        <li>Usage logs and system activity</li>
        <li>Uploaded files, code, and research data</li>
        <li>Device and browser information</li>
      </ul>

      <h2>3. How We Use Information</h2>
      <ul>
        <li>To manage internal developer access</li>
        <li>To improve system performance and tools</li>
        <li>To maintain security and prevent misuse</li>
        <li>To support research and development workflows</li>
      </ul>

      <h2>4. Data Sharing</h2>
      <p>
        We do not sell or share personal data externally. Data may only be shared 
        internally within authorized PRAUSDIT systems and services.
      </p>

      <h2>5. Data Security</h2>
      <p>
        We implement strict security measures including authentication, access control, 
        and encrypted storage to protect internal data.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        Data is retained only as long as necessary for development and operational purposes.
      </p>

      <h2>7. Developer Responsibilities</h2>
      <p>
        Developers must ensure that no sensitive or unauthorized external data is uploaded 
        without proper permission.
      </p>

      <h2>8. Changes to Policy</h2>
      <p>
        This Privacy Policy may be updated at any time. Continued use of the platform 
        indicates acceptance of the updated policy.
      </p>

      <h2>9. Contact</h2>
      <p>
        For any questions regarding this policy, contact the PRAUSDIT administration team.
      </p>

      <p className="text-sm text-gray-500">
        Last Updated: {new Date().toLocaleDateString()}
      </p>
    </main>
  );
}
