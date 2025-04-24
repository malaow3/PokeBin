import { createSignal } from "solid-js";

const OtsBattleUpload = (props: {
  text: string;
  author: string;
  pokebin_url: string;
  format: string;
  id: string;
}) => {
  const [text] = createSignal(props.text);
  const [author] = createSignal(props.author);
  const [pokebin_url] = createSignal(props.pokebin_url);
  const [format] = createSignal(props.format);
  const [data, setData] = createSignal<HTMLInputElement | undefined>();
  const [id] = createSignal(props.id);

  const form_id = `OTSPokeBinForm-${id()}`;

  const ots_process_button = async (e: Event) => {
    e.preventDefault();
    if (!text() || !author()) {
      console.warn("Missing text or author information. Cannot submit form.");
      return;
    }
    const data_element = data();
    if (!data_element) {
      return false;
    }
    const form = document.getElementById(form_id) as HTMLFormElement;

    const base_data = {
      title: `${author()}'s OTS`,
      author: author(),
      format: format(),
      rental: "",
      notes: "",
      content: text(),
    };

    const form_data = {
      encrypted: false,
      data: base_data,
    };

    const jsonString = JSON.stringify(form_data);

    // Base64 encode the JSON string safely
    const encoded = btoa(decodeURIComponent(encodeURIComponent(jsonString)));

    data_element.value = encoded;
    form.submit();
  };

  return (
    <main>
      <br />
      <div class="group">
        <form
          id={form_id}
          method="post"
          action={`${pokebin_url()}/create`}
          target="_blank"
          class="form-row"
          onSubmit={ots_process_button}
        >
          <button class="button" type="submit">
            Upload to PokeBin
          </button>
          <input name="data" id="data" hidden ref={setData} />
        </form>
      </div>
      <style>{`
        .group {
          display: flex;
          flex-direction: row;
          align-items: center;
        }
        .form-row {
          display: flex;
          flex-direction: row;
          align-items: center;
        }
        .form-row > * {
          margin-right: 10px;
        }
        .custom-input {
          border-radius: 5px;
        }
      `}</style>
    </main>
  );
};

export default OtsBattleUpload;
