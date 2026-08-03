Set fileSystem = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDirectory
shell.Run Chr(34) & scriptDirectory & "\run-server.cmd" & Chr(34), 0, False
