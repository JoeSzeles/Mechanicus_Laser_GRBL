import modulefinder

finder = modulefinder.ModuleFinder()
finder.run_script("Mechanicus Main app File.py")

print("Modules used:")
for name, mod in finder.modules.items():
    print(name, mod.__file__)