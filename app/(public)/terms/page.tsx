export default function TermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-10 prose">
      <h1>Terms & Conditions</h1>

      <p>
        These Terms & Conditions govern the use of <strong>Prostit Research Lab (PRAUSDIT)</strong>, 
        an internal development and research platform.
      </p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing this platform, you agree to comply with these terms. 
        If you do not agree, you must not use the system.
      </p>

      <h2>2. Internal Use Only</h2>
      <p>
        This platform is strictly for internal developers and authorized personnel. 
        Public or unauthorized access is prohibited.
      </p>

      <h2>3. User Responsibilities</h2>
      <ul>
        <li>Maintain confidentiality of credentials</li>
        <li>Use the platform only for intended development purposes</li>
        <li>Avoid misuse, abuse, or illegal activities</li>
      </ul>

      <h2>4. Intellectual Property</h2>
      <p>
        All content, code, and research developed within PRAUSDIT remains the 
        property of the organization unless stated otherwise.
      </p>

      <h2>5. Access Control</h2>
      <p>
        The administration reserves the right to grant, restrict, or revoke access 
        at any time without prior notice.
      </p>

      <h2>6. System Availability</h2>
      <p>
        We do not guarantee uninterrupted access. The platform may be modified, 
        suspended, or discontinued at any time.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        PRAUSDIT is not liable for any data loss, system issues, or damages arising 
        from the use of the platform.
      </p>

      <h2>8. Security Violations</h2>
      <p>
        Any attempt to breach system security or misuse data may result in immediate 
        termination and possible legal action.
      </p>

      <h2>9. Modifications</h2>
      <p>
        Terms may be updated at any time. Continued use indicates acceptance of changes.
      </p>

      <h2>10. Contact</h2>
      <p>
        For questions regarding these terms, contact the PRAUSDIT admin team.
      </p>

      <p className="text-sm text-gray-500">
        Last Updated: {new Date().toLocaleDateString()}
      </p>
    </main>
  );
        }
