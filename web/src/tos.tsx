import { render } from "solid-js/web";
import "./app.css";
import { onMount } from "solid-js";

const Tos = () => {
  onMount(() => {
    const wsUrl = "/ws";
    const socket = new WebSocket(wsUrl);
    socket.onopen = async () => {
      console.log("WebSocket connected to:", wsUrl);
    };
  });
  return (
    <>
      <div class="text-white">
        <div
          class="container mx-auto px-4"
          style="max-width: 800px; margin: 0 auto; padding: 1rem;"
        >
          <h1
            class="text-4xl font-bold mb-4"
            style="font-size: 2.25rem; font-weight: bold; margin-bottom: 1rem;"
          >
            Terms of <span class="text-pink-600">Service</span>
          </h1>
          <p
            class="text-lg mb-4"
            style="font-size: 1.125rem; margin-bottom: 1rem;"
          >
            By using this site, you agree to be solely responsible for the
            content you post. You acknowledge that you are responsible for
            ensuring that your content complies with all applicable laws and
            regulations.
          </p>

          <h2
            class="text-2xl font-bold mb-2"
            style="font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem;"
          >
            1. User Content
          </h2>
          <p
            class="text-lg mb-4"
            style="font-size: 1.125rem; margin-bottom: 1rem;"
          >
            Prohibited content includes, but is not limited to:
          </p>
          <ul class="ml-10" style="margin-left: 2.5rem;">
            <li style="list-style: disc; margin-left: 0; padding-left: 1em; text-indent: -1em;">
              Copyright infringement
            </li>
            <li style="list-style: disc; margin-left: 0; padding-left: 1em; text-indent: -1em;">
              Violation of local laws
            </li>
            <li style="list-style: disc; margin-left: 0; padding-left: 1em; text-indent: -1em;">
              Promotion of violence
            </li>
            <li style="list-style: disc; margin-left: 0; padding-left: 1em; text-indent: -1em;">
              Hate speech
            </li>
          </ul>

          <p
            class="text-lg mb-4"
            style="font-size: 1.125rem; margin-bottom: 1rem;"
          >
            Users can report content that violates these terms using the
            <a href="/report" class="text-sky-500 hover:text-pink-500">
              {" "}
              report{" "}
            </a>{" "}
            page. All reported content is subject to review. Any content
            uploaded to the site may be removed at any time without explanation.
          </p>

          <h2
            class="text-2xl font-bold mb-2"
            style="font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem;"
          >
            2. Password-Protected Content
          </h2>
          <p
            class="text-lg mb-4"
            style="font-size: 1.125rem; margin-bottom: 1rem;"
          >
            While you may password-protect your content, please be aware that
            reported password-protected content may be purged without review.
          </p>

          <h2
            class="text-2xl font-bold mb-2"
            style="font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem;"
          >
            3. Data Collection
          </h2>
          <p
            class="text-lg mb-4"
            style="font-size: 1.125rem; margin-bottom: 1rem;"
          >
            In addition to collecting paste information, we use Google Analytics
            to collection anonymous data about website usage. This data
            includes, but is not limited to, website traffic, page views, and
            user interactions. This information is used to improve the website
            and user experience. By using this site, you consent to the
            collection and processing of your data by Google Analytics in
            accordance with Google's privacy policy.{" "}
          </p>

          <h2
            class="text-2xl font-bold mb-2"
            style="font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem;"
          >
            4. Modification of Terms
          </h2>
          <p
            class="text-lg mb-4"
            style="font-size: 1.125rem; margin-bottom: 1rem;"
          >
            We reserve the right to modify these Terms of Service at any time
            without prior notice. Your continued use of the site following any
            changes constitutes your acceptance of the revised Terms.
          </p>

          <h2
            class="text-2xl font-bold mb-2"
            style="font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem;"
          >
            5. Disclaimer of Liability
          </h2>
          <p
            class="text-lg mb-4"
            style="font-size: 1.125rem; margin-bottom: 1rem;"
          >
            We are not liable for any damages, direct or indirect, arising from
            your use of the site or the content posted by users. We do not
            endorse or guarantee the accuracy, completeness, or reliability of
            any user-generated content.
          </p>
        </div>
      </div>
    </>
  );
};

const root = document.getElementById("root");
if (root) {
  render(() => <Tos />, root);
}
