import type { Character, Project } from "../lib/types";
import { uid } from "../lib/types";
import { Button, TextArea, TextInput } from "./ui";

interface Props {
  project: Project;
  patch: (patch: Partial<Project>) => void;
}

export function CastPanel({ project, patch }: Props) {
  const update = (id: string, patchCharacter: Partial<Character>) => {
    patch({
      characters: project.characters.map((character) =>
        character.id === id ? { ...character, ...patchCharacter } : character,
      ),
    });
  };

  const add = () => {
    patch({
      characters: [
        ...project.characters,
        { id: uid("char"), name: "", look: "", promptFragment: "" },
      ],
    });
  };

  const remove = (id: string) => {
    patch({ characters: project.characters.filter((character) => character.id !== id) });
  };

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-semibold text-white/85">角色表</h2>
            <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-white/40">
              角色一致性靠两点：每张分镜提示词里重复同一段英文外形描述；同一项目用连续 seed。
              剧本里出现角色名时，这段描述会自动拼进提示词。
            </p>
          </div>
          <Button variant="primary" onClick={add}>
            + 添加角色
          </Button>
        </div>
      </section>

      {project.characters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/12 px-4 py-8 text-center text-[12px] text-white/40">
          还没有角色。添加一个，剧本里写到名字时会自动带进提示词。
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {project.characters.map((character, index) => (
          <section key={character.id} className="panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-white/35">
                角色 {index + 1}
              </span>
              <Button variant="plain" onClick={() => remove(character.id)} className="text-rose-300/70 hover:text-rose-200">
                删除
              </Button>
            </div>
            <div className="space-y-2.5">
              <TextInput
                label="名字（与剧本一致）"
                value={character.name}
                onChange={(event) => update(character.id, { name: event.target.value })}
                placeholder="陈默"
              />
              <TextArea
                label="中文设定"
                rows={2}
                value={character.look}
                onChange={(event) => update(character.id, { look: event.target.value })}
                placeholder="29 岁，短黑发，瘦，黑色 T 恤，眼下疲惫"
              />
              <TextArea
                label="英文外形提示词（进画面）"
                rows={2}
                value={character.promptFragment}
                onChange={(event) => update(character.id, { promptFragment: event.target.value })}
                placeholder="Chen Mo, 29-year-old Chinese man, short black hair, tired eyes, plain black t-shirt"
                className="font-mono text-[11.5px]"
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
